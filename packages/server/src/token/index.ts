import { createPrivateKey, createPublicKey } from 'node:crypto'
import { type } from 'arktype'
import { Hookable } from 'hookable'
import { nanoid } from 'nanoid'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import {
  BusinessError,
  logger,
  Permission,
  SecurityLevel,
  tSecurityLevel,
  UAAA
} from '../util/index.js'
import type { App, IAppDoc, ITokenDoc } from '../index.js'
import ms from 'ms'

export const tTokenPayload = type({
  iss: 'string',
  sub: 'string',
  'aud?': 'string',
  'client_id?': 'string|undefined',
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
}

export class TokenManager extends Hookable<{}> {
  sessionTimeout: number
  tokenTimeouts: number[]
  refreshTimeouts: number[]
  sessionTokenTimeouts: number[]

  constructor(public app: App) {
    super()
    this.sessionTimeout = ms(app.config.get('sessionTimeout'))
    this.tokenTimeouts = this._loadTimeouts(app.config.get('tokenTimeout'))
    this.sessionTokenTimeouts = this._loadTimeouts(
      app.config.get('sessionTokenTimeout') ?? app.config.get('tokenTimeout')
    )
    this.refreshTimeouts = this._loadTimeouts(app.config.get('refreshTimeout'))
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
      keys: pairs.map(({ _id, publicKey }) => ({ kid: _id.toHexString(), ...publicKey }))
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
          issuer: this.app.config.get('deploymentUrl'),
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
      return new BusinessError('TOKEN_NOT_BEFORE', {})
    }
    return new BusinessError('INVALID_TOKEN', {})
  }

  async verify(
    token: string,
    mapVerifyError: (err: jwt.VerifyErrors | null) => Error = this._mapVerifyError
  ) {
    const result = await new Promise<jwt.Jwt>((resolve, reject) =>
      jwt.verify(
        token,
        async ({ kid }, cb) => {
          try {
            const doc = await this.app.db.jwkpairs.findOne({ _id: new ObjectId(kid) })
            if (!doc) throw new BusinessError('INVALID_TOKEN', {})
            cb(null, createPublicKey({ key: doc.publicKey, format: 'jwk' }))
          } catch (err) {
            cb(err as Error)
          }
        },
        { complete: true },
        (err, decoded) => (decoded ? resolve(decoded) : reject(mapVerifyError(err)))
      )
    )
    return result
  }

  async createToken(
    token: Omit<ITokenDoc, '_id' | 'code'>,
    { generateCode = true }: ICreateTokenOptions = {}
  ): Promise<ITokenDoc> {
    const doc: ITokenDoc = { _id: nanoid(), ...token }
    if (generateCode) {
      doc.code ??= nanoid()
    }
    await this.app.db.tokens.insertOne(doc, { ignoreUndefined: true })
    return doc
  }

  async signToken(tokenDoc: ITokenDoc) {
    if (tokenDoc.terminated) {
      throw new BusinessError('TOKEN_TERMINATED', {})
    }
    const now = Date.now()
    if (now >= tokenDoc.expiresAt) {
      throw new BusinessError('TOKEN_EXPIRED', {})
    }

    const tokenExpiresAt = Math.min(tokenDoc.expiresAt, now + tokenDoc.tokenTimeout)
    let refreshToken: string | undefined
    let refreshExpiresAt: number | undefined
    if (tokenExpiresAt < tokenDoc.expiresAt) {
      refreshToken = nanoid()
      refreshExpiresAt = Math.min(tokenDoc.expiresAt, now + tokenDoc.refreshTimeout)
    }
    await this.app.db.tokens.updateOne(
      { _id: tokenDoc._id },
      {
        $set: {
          refreshToken,
          refreshExpiresAt,
          tokenExpiresAt,
          lastIssuedAt: now
        },
        $inc: {
          issuedCount: 1
        }
      },
      { ignoreUndefined: true }
    )
    await this.app.db.sessions.updateOne(
      { _id: tokenDoc.sessionId },
      { $max: { expiresAt: Math.max(tokenExpiresAt, refreshExpiresAt ?? 0) } }
    )

    const permissions = tokenDoc.permissions
      .map((perm) => Permission.fromCompactString(perm))
      .filter((perm) => perm.appId === UAAA)
      .map((perm) => perm.toScopedString())
    if (!permissions.length) {
      throw new BusinessError('BAD_REQUEST', { msg: 'No permissions granted for UAAA' })
    }
    const token = await this.sign(
      {
        client_id: tokenDoc.clientAppId,
        sid: tokenDoc.sessionId,
        perm: permissions,
        level: tokenDoc.securityLevel,
        iat: Math.floor(now / 1000),
        exp: Math.floor(tokenExpiresAt / 1000)
      },
      { subject: tokenDoc.userId, jwtid: tokenDoc._id }
    )
    return { token, refreshToken }
  }

  async exchangeToken(payload: ITokenPayload, targetAppId: string) {
    if (!payload.client_id) {
      throw new BusinessError('INVALID_TOKEN', {})
    }
    const tokenDoc = await this.app.db.tokens.findOne({
      _id: payload.jti,
      userId: payload.sub,
      clientAppId: payload.client_id,
      terminated: { $ne: true }
    })
    if (!tokenDoc) {
      throw new BusinessError('INVALID_TOKEN', {})
    }
    const permissions = tokenDoc.permissions
      .map((perm) => Permission.fromCompactString(perm))
      .filter((perm) => perm.appId === targetAppId)
      .map((perm) => perm.toScopedString())
    if (!permissions.length) {
      throw new BusinessError('FORBIDDEN', {
        msg: 'Token does not have permission to access target app'
      })
    }
    const token = await this.sign({ ...payload, perm: permissions }, { audience: targetAppId })
    return { token }
  }

  async refreshToken(
    refreshToken: string,
    client: { id?: string | undefined; secret?: string | undefined; app?: IAppDoc | null }
  ) {
    const tokenDoc = await this.app.db.tokens.findOneAndUpdate(
      {
        refreshToken,
        refreshExpiresAt: { $gt: Date.now() },
        clientAppId: client.id ? client.id : { $exists: false },
        terminated: { $ne: true }
      },
      { $unset: { refreshToken: '' } }
    )
    if (!tokenDoc) {
      throw new BusinessError('INVALID_TOKEN', {})
    }
    if (tokenDoc.confidential && client.id) {
      let clientApp = client.app
      clientApp ??= await this.app.db.apps.findOne(
        { _id: client.id },
        { projection: { secret: 1 } }
      )
      if (!clientApp || clientApp.secret !== client.secret) {
        throw new BusinessError('INVALID_TOKEN', {})
      }
    }
    return this.signToken(tokenDoc)
  }

  async createAndSignToken(token: Omit<ITokenDoc, '_id'>, options: ICreateTokenOptions = {}) {
    const tokenDoc = await this.createToken(token, options)
    const generated = await this.signToken(tokenDoc)
    return tokenDoc.code ? { ...generated, code: tokenDoc.code } : generated
  }

  async verifyToken(token: string) {
    const jwt = await this.verify(token)
    const payload = tTokenPayload(jwt.payload)
    if (payload instanceof type.errors) {
      throw new BusinessError('INVALID_TOKEN', {})
    }
    return {
      jwt,
      payload
    }
  }

  async verifyUAAAToken(token: string) {
    const { jwt, payload } = await this.verifyToken(token)
    if (Object.hasOwn(payload, 'aud')) {
      throw new BusinessError('INVALID_TOKEN', {})
    }
    return { jwt, payload }
  }

  getTokenTimeout(securityLevel: SecurityLevel, suggested?: number) {
    return suggested ?? this.tokenTimeouts[securityLevel]
  }

  getRefreshTimeout(securityLevel: SecurityLevel, suggested?: number) {
    return suggested ?? this.refreshTimeouts[securityLevel]
  }

  getSessionTokenTimeout(securityLevel: SecurityLevel, suggested?: number) {
    return suggested ?? this.sessionTokenTimeouts[securityLevel]
  }
}
