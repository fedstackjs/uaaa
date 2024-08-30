import { createPrivateKey, createPublicKey } from 'node:crypto'
import { type } from 'arktype'
import { Hookable } from 'hookable'
import { nanoid } from 'nanoid'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { HTTPException } from 'hono/http-exception'
import type { App } from '../index.js'
import { ITokenDoc } from '../db/model/token.js'

export const tTokenPayload = type({
  iss: 'string',
  sub: 'string',
  'aud?': 'string',
  'client_id?': 'string|undefined',
  sid: 'string',
  jti: 'string',
  perm: 'string[]',
  level: 'number',
  exp: 'number',
  iat: 'number'
})

export type ITokenPayload = typeof tTokenPayload.infer

export class TokenManager extends Hookable<{}> {
  constructor(public app: App) {
    super()
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

  async verify(token: string) {
    const result = await new Promise<jwt.Jwt>((resolve, reject) =>
      jwt.verify(
        token,
        async ({ kid }, cb) => {
          try {
            const doc = await this.app.db.jwkpairs.findOne({ _id: new ObjectId(kid) })
            if (!doc) throw new HTTPException(401)
            cb(null, createPublicKey({ key: doc.publicKey, format: 'jwk' }))
          } catch (err) {
            cb(err as Error)
          }
        },
        { complete: true },
        (err, decoded) => (decoded ? resolve(decoded) : reject(err))
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
      throw new HTTPException(400, { cause: 'Token terminated' })
    }
    const now = Date.now()
    if (now >= tokenDoc.expiresAt) {
      throw new HTTPException(400, { cause: 'Token expired' })
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

    const token = await this.sign(
      {
        client_id: tokenDoc.clientAppId,
        sid: tokenDoc.sessionId,
        perm: tokenDoc.permissions,
        level: tokenDoc.securityLevel,
        iat: Math.floor(now / 1000),
        exp: Math.floor(tokenExpiresAt / 1000)
      },
      {
        subject: tokenDoc.userId,
        audience: tokenDoc.targetAppId,
        jwtid: tokenDoc._id
      }
    )
    return { token, refreshToken }
  }

  async refreshToken(refreshToken: string) {
    const tokenDoc = await this.app.db.tokens.findOneAndUpdate(
      { refreshToken, refreshExpiresAt: { $gt: Date.now() } },
      { $unset: { refreshToken: '' } }
    )
    if (!tokenDoc || tokenDoc.terminated) {
      throw new HTTPException(401, { cause: 'Invalid refresh token' })
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
      throw new HTTPException(401, { cause: 'Invalid token' })
    }
    return {
      jwt,
      payload
    }
  }

  async verifyUAAAToken(token: string) {
    const { jwt, payload } = await this.verifyToken(token)
    if (Object.hasOwn(payload, 'aud')) {
      throw new HTTPException(401, { cause: 'Invalid token' })
    }
    return { jwt, payload }
  }
}
