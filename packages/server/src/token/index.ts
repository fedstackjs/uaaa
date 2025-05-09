import { createPrivateKey, createPublicKey, KeyObject } from 'node:crypto'
import { type } from 'arktype'
import { Hookable } from 'hookable'
import { nanoid } from 'nanoid'
import jwt from 'jsonwebtoken'
import { BusinessError, logger, Permission, tSecurityLevel } from '../util/index.js'
import type { App, IAppDoc, ITokenDoc, SecurityLevel } from '../index.js'
import ms from 'ms'

export const tTokenPayload = type({
  iss: 'string',
  sub: 'string',
  aud: 'string',
  client_id: 'string',
  sid: 'string',
  jti: 'string',
  perm: type('string')
    // TODO: should be validated as scoped permission
    .narrow((s) => s.startsWith('/'))
    .array(),
  level: tSecurityLevel,
  exp: 'number',
  iat: 'number'
})

export type ITokenPayload = typeof tTokenPayload.infer

export interface ICreateTokenOptions {
  generateCode?: boolean
  mergeActive?: boolean
  timestamp?: number
}

export class TokenManager extends Hookable<{}> {
  issuer
  trustedUpstreamIssuers: string[]
  trustedUpstreamKeys: Record<string, KeyObject>
  trustedLocalKeys: Record<string, KeyObject>

  jwtTimeouts: number[]
  refreshTimeouts: number[]
  tokenTimeouts: number[]

  constructor(public app: App) {
    super()
    this.issuer = this.app.config.get('deploymentUrl')
    this.trustedUpstreamIssuers = this.app.config.get('trustedUpstreamIssuers') ?? []
    this.trustedUpstreamKeys = Object.create(null)
    this.trustedLocalKeys = Object.create(null)

    this.tokenTimeouts = this._loadTimeouts(app.config.get('tokenTimeout'))
    this.jwtTimeouts = this._loadTimeouts(app.config.get('jwtTimeout'))
    this.refreshTimeouts = this._loadTimeouts(app.config.get('refreshTimeout'))
  }

  private async _fetchUpstreamKeys(upstream: string) {
    const discoveryUrl = new URL('.well-known/openid-configuration', upstream)
    const discoveryRes = await fetch(discoveryUrl)
    const discovery = await discoveryRes.json()
    const jwksUrl = new URL(discovery.jwks_uri, upstream)
    const jwksRes = await fetch(jwksUrl)
    const jwks = await jwksRes.json()
    for (const key of jwks.keys) {
      const jwk = createPublicKey({ key, format: 'jwk' })
      this.trustedUpstreamKeys[key.kid] = jwk
      logger.info(`Added key from upstream ${upstream}: ${key.kid}`)
    }
  }

  async fetchTrustedUpstreamKeys() {
    for (const upstream of this.trustedUpstreamIssuers) {
      try {
        await this._fetchUpstreamKeys(upstream)
      } catch (err) {
        logger.error(`Failed to fetch keys from upstream ${upstream}: ${err}`)
      }
    }
  }

  async loadTrustedLocalKeys() {
    const pairs = this.app.db.jwkpairs.find()
    for await (const pair of pairs) {
      const publicKey = createPublicKey({ key: pair.publicKey, format: 'jwk' })
      this.trustedLocalKeys[pair._id.toHexString()] = publicKey
      logger.info(`Added local key: ${pair._id}`)
    }
  }

  async loadTrustedKeys() {
    await this.loadTrustedLocalKeys()
    await this.fetchTrustedUpstreamKeys()
  }

  private _loadTimeouts(config: string | string[]): number[] {
    if (!Array.isArray(config)) {
      logger.warn('Token timeout set to a single value for all security levels')
      return new Array(5).fill(ms(config))
    }
    if (config.length !== 5) throw new Error('Invalid config: timeout must be an array of 5 values')
    return config.map(ms)
  }

  async getJWKS() {
    const pairs = await this.app.db.jwkpairs.find().toArray()
    return {
      keys: pairs.map(({ _id, publicKey }) => ({
        kid: _id.toHexString(),
        alg: 'RS256',
        use: 'sig',
        ...publicKey
      }))
    }
  }

  async sign(payload: string | Buffer | object, options: jwt.SignOptions = {}) {
    const pair = await this.app.db.jwkpairs.findOne()
    if (!pair) throw new Error('No key pair found')
    const token = await new Promise<string>((resolve, reject) =>
      jwt.sign(
        payload,
        createPrivateKey({ key: pair.privateKey, format: 'jwk' }),
        {
          algorithm: 'RS256',
          keyid: pair._id.toHexString(),
          issuer: this.issuer,
          ...options
        },
        (err, token) => (token ? resolve(token) : reject(err))
      )
    )
    return token
  }

  private _mapVerifyError(err: jwt.VerifyErrors | null) {
    if (err instanceof jwt.TokenExpiredError) {
      return new BusinessError('TOKEN_EXPIRED', {})
    }
    if (err instanceof jwt.NotBeforeError) {
      return new BusinessError('TOKEN_PENDING', {})
    }
    return new BusinessError('TOKEN_INVALID_JWT', {})
  }

  async verify(
    token: string,
    mapVerifyError: (err: jwt.VerifyErrors | null) => Error = this._mapVerifyError,
    options: jwt.VerifyOptions = {}
  ) {
    const result = await new Promise<jwt.Jwt>((resolve, reject) =>
      jwt.verify(
        token,
        async ({ kid }, cb) => {
          if (!kid) return cb(new BusinessError('TOKEN_INVALID_JWT', {}))
          const key = this.trustedLocalKeys[kid] ?? this.trustedUpstreamKeys[kid]
          if (!key) return cb(new BusinessError('TOKEN_INVALID_JWT', {}))
          return cb(null, key)
        },
        {
          issuer: this.issuer,
          ...options,
          complete: true
        },
        (err, decoded) => (decoded ? resolve(decoded) : reject(mapVerifyError(err)))
      )
    )
    return result
  }

  /**
   * Creates a token for the user.
   *
   * Note: if token.parentId is specified, the parent token must be checked.
   *
   * @param token - Information for the token to be created.
   * @param options - Options for token generation.
   * @returns The created token document.
   */
  async createToken(
    token: Omit<ITokenDoc, '_id' | 'code'>,
    { generateCode = true, mergeActive = true, timestamp = Date.now() }: ICreateTokenOptions = {}
  ): Promise<ITokenDoc> {
    if (mergeActive) {
      // Select the last active token and update it,
      // or create a new token if no active token is found.
      const doc = await this.app.db.tokens.findOneAndUpdate(
        {
          userId: token.userId,
          sessionId: token.sessionId,
          parentId: token.parentId ? token.parentId : { $exists: false },
          appId: token.appId,
          securityLevel: token.securityLevel,
          expiresAt: { $gt: timestamp },
          terminated: { $ne: true }
        },
        {
          $setOnInsert: {
            _id: nanoid(),
            userId: token.userId,
            sessionId: token.sessionId,
            parentId: token.parentId,
            appId: token.appId,
            securityLevel: token.securityLevel,
            createdAt: token.createdAt,
            jwtTimeout: token.jwtTimeout,
            refreshTimeout: token.refreshTimeout
          },
          $set: {
            confidential: token.confidential,
            remote: token.remote,
            nonce: token.nonce,
            challenge: token.challenge,
            code: generateCode ? nanoid() : undefined,
            // TODO: consider how to merge environment
            environment: token.environment
          },
          $max: {
            expiresAt: token.expiresAt,
            updatedAt: token.updatedAt,
            activatedAt: token.activatedAt
          },
          $addToSet: {
            permissions: { $each: token.permissions }
          },
          $inc: {
            activatedCount: 1
          }
        },
        {
          upsert: true,
          returnDocument: 'after',
          ignoreUndefined: true,
          // If we accidentally have two active tokens,
          // update one that expires later.
          sort: { expiresAt: -1 }
        }
      )
      return doc!
    } else {
      const doc = {
        _id: nanoid(),
        ...token,
        code: generateCode ? nanoid() : undefined
      }
      await this.app.db.tokens.insertOne(doc, { ignoreUndefined: true })
      return doc
    }
  }

  async signToken(tokenDoc: ITokenDoc, targetAppId?: string) {
    if (tokenDoc.terminated) {
      throw new BusinessError('TOKEN_TERMINATED', {})
    }
    const now = Date.now()
    if (now >= tokenDoc.expiresAt) {
      throw new BusinessError('TOKEN_EXPIRED', {})
    }

    const parsedPermissions = tokenDoc.permissions.map((perm) => Permission.fromCompactString(perm))
    const containsUAAA = parsedPermissions.some((perm) => perm.appId === this.app.appId)
    targetAppId ??= containsUAAA ? this.app.appId : parsedPermissions[0].appId
    if (!targetAppId) {
      throw new BusinessError('TOKEN_INVALID_CONFIG', {})
    }

    const jwtExpiresAt = Math.min(tokenDoc.expiresAt, now + tokenDoc.jwtTimeout)
    const refreshToken = nanoid()
    const refreshExpiresAt = Math.min(tokenDoc.expiresAt, now + tokenDoc.refreshTimeout)
    await this.app.db.tokens.updateOne(
      { _id: tokenDoc._id },
      {
        $set: { refreshToken, refreshExpiresAt, jwtExpiresAt, lastIssuedAt: now },
        $inc: { issuedCount: 1 }
      },
      { ignoreUndefined: true }
    )
    await this.app.db.sessions.updateOne(
      { _id: tokenDoc.sessionId },
      { $max: { expiresAt: Math.max(jwtExpiresAt, refreshExpiresAt) } }
    )

    const permissions = tokenDoc.permissions
      .map((perm) => Permission.fromCompactString(perm))
      .filter((perm) => perm.appId === targetAppId)
      .map((perm) => perm.toScopedString())
    if (!permissions.length) {
      throw new BusinessError('BAD_REQUEST', { msg: 'No permissions granted for UAAA' })
    }
    const token = await this.sign(
      {
        client_id: tokenDoc.appId,
        sid: tokenDoc.sessionId,
        perm: permissions,
        level: tokenDoc.securityLevel,
        iat: Math.floor(now / 1000),
        exp: Math.floor(jwtExpiresAt / 1000)
      },
      { subject: tokenDoc.userId, jwtid: tokenDoc._id, audience: targetAppId }
    )
    return { token, refreshToken }
  }

  async refreshToken(
    refreshToken: string,
    client: { id: string; secret?: string | undefined; app?: IAppDoc | null },
    targetAppId?: string
  ) {
    const tokenDoc = await this.app.db.tokens.findOneAndUpdate(
      {
        refreshToken,
        refreshExpiresAt: { $gt: Date.now() },
        appId: client.id,
        terminated: { $ne: true }
      },
      { $unset: { refreshToken: '' } }
    )
    if (!tokenDoc) {
      throw new BusinessError('TOKEN_INVALID_REFRESH', {})
    }
    if (tokenDoc.confidential && client.id) {
      let clientApp = client.app
      clientApp ??= await this.app.db.apps.findOne(
        { _id: client.id },
        { projection: { secret: 1 } }
      )
      if (!clientApp || clientApp.secret !== client.secret) {
        throw new BusinessError('TOKEN_INVALID_CLIENT', {})
      }
    }
    return this.signToken(tokenDoc, targetAppId)
  }

  async createAndSignToken(
    token: Omit<ITokenDoc, '_id'>,
    options: Omit<ICreateTokenOptions, 'generateCode'> = {},
    targetAppId?: string
  ) {
    const tokenDoc = await this.createToken(token, { ...options, generateCode: false })
    return this.signToken(tokenDoc, targetAppId)
  }

  async verifyToken(token: string) {
    const jwt = await this.verify(token)
    const payload = tTokenPayload(jwt.payload)
    if (payload instanceof type.errors) {
      throw new BusinessError('TOKEN_INVALID_JWT', {})
    }
    return {
      jwt,
      payload
    }
  }

  async verifyUAAAToken(token: string) {
    const { jwt, payload } = await this.verifyToken(token)
    if (payload.aud !== this.app.appId) {
      throw new BusinessError('TOKEN_INVALID_JWT', {})
    }
    return { jwt, payload }
  }

  getJwtTimeout(securityLevel: SecurityLevel, suggested?: number) {
    return suggested ?? this.jwtTimeouts[securityLevel]
  }

  getRefreshTimeout(securityLevel: SecurityLevel, suggested?: number) {
    return suggested ?? this.refreshTimeouts[securityLevel]
  }

  getTokenTimeout(securityLevel: SecurityLevel, suggested?: number) {
    return suggested ?? this.tokenTimeouts[securityLevel]
  }
}
