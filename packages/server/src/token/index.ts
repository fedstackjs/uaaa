import { createPrivateKey, createPublicKey } from 'node:crypto'
import { type } from 'arktype'
import { Hookable } from 'hookable'
import { nanoid } from 'nanoid'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { BusinessError, logger, SecurityLevel, tSecurityLevel } from '../util/index.js'
import type { App } from '../index.js'
import type { ITokenDoc } from '../db/model/token.js'
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
    return new BusinessError('TOKEN_INVALID', {})
  }

  async verify(token: string) {
    const result = await new Promise<jwt.Jwt>((resolve, reject) =>
      jwt.verify(
        token,
        async ({ kid }, cb) => {
          try {
            const doc = await this.app.db.jwkpairs.findOne({ _id: new ObjectId(kid) })
            if (!doc) throw new BusinessError('TOKEN_INVALID', {})
            cb(null, createPublicKey({ key: doc.publicKey, format: 'jwk' }))
          } catch (err) {
            cb(err as Error)
          }
        },
        { complete: true },
        (err, decoded) => (decoded ? resolve(decoded) : reject(this._mapVerifyError(err)))
      )
    )
    return result
  }

  async createToken(token: Omit<ITokenDoc, '_id'>): Promise<ITokenDoc> {
    const doc = { _id: nanoid(), ...token }
    await this.app.db.tokens.insertOne(doc)
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

    const signOptions: jwt.SignOptions = {
      subject: tokenDoc.userId,
      jwtid: tokenDoc._id
    }
    if (tokenDoc.targetAppId) {
      signOptions.audience = tokenDoc.targetAppId
    }
    const token = await this.sign(
      {
        client_id: tokenDoc.clientAppId,
        sid: tokenDoc.sessionId,
        perm: tokenDoc.permissions,
        level: tokenDoc.securityLevel,
        iat: Math.floor(now / 1000),
        exp: Math.floor(tokenExpiresAt / 1000)
      },
      signOptions
    )
    return { token, refreshToken }
  }

  async refreshToken(refreshToken: string, clientId?: string) {
    const tokenDoc = await this.app.db.tokens.findOneAndUpdate(
      {
        refreshToken,
        refreshExpiresAt: { $gt: Date.now() },
        clientAppId: clientId ? clientId : { $exists: false },
        terminated: { $ne: true }
      },
      { $unset: { refreshToken: '' } }
    )
    if (!tokenDoc) {
      throw new BusinessError('TOKEN_INVALID', {})
    }
    return this.signToken(tokenDoc)
  }

  async createAndSignToken(token: Omit<ITokenDoc, '_id'>) {
    const tokenDoc = await this.createToken(token)
    return this.signToken(tokenDoc)
  }

  async verifyToken(token: string) {
    const jwt = await this.verify(token)
    const payload = tTokenPayload(jwt.payload)
    if (payload instanceof type.errors) {
      throw new BusinessError('TOKEN_INVALID', {})
    }
    return {
      jwt,
      payload
    }
  }

  async verifyUAAAToken(token: string) {
    const { jwt, payload } = await this.verifyToken(token)
    if (Object.hasOwn(payload, 'aud')) {
      throw new BusinessError('TOKEN_INVALID', {})
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
