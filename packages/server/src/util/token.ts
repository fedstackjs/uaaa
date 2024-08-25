import { createPrivateKey, createPublicKey } from 'node:crypto'
import { Hookable } from 'hookable'
import jwt from 'jsonwebtoken'
import type { App, ISessionOperationDoc } from '../index.js'
import { type } from 'arktype'
import { ObjectId } from 'mongodb'
import { HTTPException } from 'hono/http-exception'
import { nanoid } from 'nanoid'

export interface ITokenInit {
  userId: string
  targetAppId?: string | undefined
  clientAppId?: string | undefined
  sessionId: string
  tokenId: string
  permissions: string[]
  securityLevel: number
  createdAt: number
  expiresAt: number
}

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

export class TokenManager extends Hookable {
  constructor(public app: App) {
    super()
  }

  async getJWKS() {
    const pairs = await this.app.db.jwkpairs.find().toArray()
    return {
      keys: pairs.map(({ _id, publicKey }) => ({ kid: _id.toHexString(), ...publicKey }))
    }
  }

  async persistAndSign(
    index: number,
    init: Omit<ITokenInit, 'tokenId'>,
    allowRefresh = false,
    options: jwt.SignOptions = {}
  ) {
    const { insertedId } = await this.app.db.sessionOperations.insertOne(
      {
        _id: nanoid(),
        index,
        refreshCount: 0,
        refreshToken: allowRefresh ? nanoid() : undefined,
        ...init
      },
      { ignoreUndefined: true }
    )
    return this.sign({ ...init, tokenId: insertedId }, options)
  }

  async persist(index: number, init: Omit<ITokenInit, 'tokenId'>, allowRefresh = false) {
    const { insertedId } = await this.app.db.sessionOperations.insertOne({
      _id: nanoid(),
      index,
      refreshCount: 0,
      refreshToken: allowRefresh ? nanoid() : undefined,
      ...init
    })
    return insertedId
  }

  async signPersisted(
    userId: string,
    operation: ISessionOperationDoc,
    options: jwt.SignOptions = {}
  ) {
    return this.sign({ ...operation, userId, tokenId: operation._id }, options)
  }

  async signAndRefresh(refreshToken: string, expiresAt: number) {
    const operation = await this.app.db.sessionOperations.findOneAndUpdate(
      { refreshToken },
      {
        $inc: { refreshCount: 1 },
        $unset: { refreshToken: '' },
        $set: { expiresAt }
      },
      { returnDocument: 'after' }
    )
    if (!operation) throw new HTTPException(401)
    const session = await this.app.db.sessions.findOne({ _id: operation.sessionId })
    if (!session || session.terminated) throw new HTTPException(401)
    return this.signPersisted(session.userId, operation)
  }

  async sign(init: ITokenInit, options: jwt.SignOptions = {}) {
    const pair = await this.app.db.jwkpairs.findOne()
    if (!pair) throw new Error('No key pair found')
    const token = await new Promise<string>((resolve, reject) =>
      jwt.sign(
        {
          client_id: init.clientAppId,
          sid: init.sessionId,
          perm: init.permissions,
          level: init.securityLevel,
          iat: Math.floor(init.createdAt / 1000),
          exp: Math.floor(init.expiresAt / 1000)
        } satisfies Partial<ITokenPayload>,
        createPrivateKey({ key: pair.privateKey, format: 'jwk' }),
        {
          ...options,
          algorithm: 'RS256',
          keyid: pair._id.toHexString(),
          subject: init.userId,
          issuer: this.app.config.get('deploymentUrl'),
          audience: init.targetAppId,
          jwtid: init.tokenId
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
    const payload = tTokenPayload(result.payload)
    if (payload instanceof type.errors) {
      throw new HTTPException(400, { cause: payload.summary })
    }
    if (payload.aud) {
      throw new HTTPException(400, { cause: 'Invalid audience' })
    }
    return {
      jwt: result,
      payload
    }
  }
}
