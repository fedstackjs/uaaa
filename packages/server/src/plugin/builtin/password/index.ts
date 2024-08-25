import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import bcrypt from 'bcrypt'
import ms from 'ms'
import { definePlugin } from '../../_common.js'
import { CredentialContext, CredentialImpl } from '../../../credential/_common.js'
import { nanoid } from 'nanoid'

const tPasswordConfig = type({
  'passwordExpiration?': 'number|string',
  'passwordTimeout?': 'number|string'
})

type IPasswordConfig = typeof tPasswordConfig.infer

declare module '../../../index.js' {
  interface IConfig extends IPasswordConfig {}
  interface ICredentialTypeMap {
    password: string
  }
}

class PasswordImpl extends CredentialImpl {
  static readonly tPasswordLoginPayload = type({
    id: 'string',
    password: 'string'
  })
  static readonly tPasswordVerifyPayload = type({
    password: 'string'
  })

  readonly type = 'password'
  passwordExpiration
  passwordTimeout

  constructor(config: IPasswordConfig) {
    super()
    this.passwordExpiration = this.parseTimeout(config.passwordExpiration ?? '100y')
    this.passwordTimeout = this.parseTimeout(config.passwordTimeout ?? '15min')
  }

  private parseTimeout(timeout: number | string) {
    if (typeof timeout === 'number') {
      return timeout
    } else {
      return ms(timeout)
    }
  }

  override async login(ctx: CredentialContext, _payload: unknown) {
    const payload = PasswordImpl.tPasswordLoginPayload(_payload)
    if (payload instanceof type.errors) {
      throw new HTTPException(400, { cause: payload.summary })
    }

    const user = await ctx.app.db.users.findOne({
      _id: payload.id
    })
    if (!user) {
      throw new HTTPException(401)
    }

    const credential = await ctx.app.db.credentials.findOne({
      userId: payload.id,
      type: 'password'
    })
    if (!credential) {
      throw new HTTPException(401)
    }

    const match = await bcrypt.compare(payload.password, credential.secret as string)
    if (!match) {
      throw new HTTPException(401)
    }

    return {
      userId: user._id,
      credentialId: credential._id,
      securityLevel: 0,
      expiresIn: 0
    }
  }

  override async canElevate(ctx: CredentialContext, userId: string, targetLevel: number) {
    const credential = await ctx.app.db.credentials.findOne({
      userId,
      type: 'password'
    })
    if (!credential) return false
    return targetLevel === 0
  }

  override async verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: number,
    _payload: unknown
  ) {
    if (targetLevel > 0) {
      throw new HTTPException(403, {
        message: 'Password credential cannot provide security level higher than 0'
      })
    }

    const payload = PasswordImpl.tPasswordVerifyPayload(_payload)
    if (payload instanceof type.errors) {
      throw new HTTPException(400, { cause: payload.summary })
    }
    const credential = await ctx.app.db.credentials.findOne({
      userId: userId,
      type: 'password'
    })
    if (!credential) {
      throw new HTTPException(401)
    }
    const match = await bcrypt.compare(payload.password, credential.secret as string)
    if (!match) {
      throw new HTTPException(401)
    }
    return {
      credentialId: credential._id,
      securityLevel: 1,
      expiresIn: this.passwordTimeout
    }
  }

  override async bind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string | undefined,
    _payload: unknown
  ) {
    const payload = PasswordImpl.tPasswordVerifyPayload(_payload)
    if (payload instanceof type.errors) {
      throw new HTTPException(400, { cause: payload.summary })
    }
    const hashed = await bcrypt.hash(payload.password, 10)
    const { upsertedId } = await ctx.app.db.credentials.updateOne(
      {
        _id: credentialId as string,
        userId,
        type: 'password'
      },
      {
        $setOnInsert: {
          _id: nanoid(),
          data: '',
          remark: '',
          securityLevel: 1
        },
        $set: {
          secret: hashed,
          validAfter: Date.now(),
          validBefore: Date.now() + this.passwordExpiration,
          validCount: Infinity
        }
      },
      { ignoreUndefined: true }
    )
    credentialId = (upsertedId ?? credentialId) as string
    return {
      credentialId
    }
  }

  override async unbind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string,
    _payload: unknown
  ) {
    const credential = await ctx.app.db.credentials.findOne({
      _id: credentialId,
      userId,
      type: 'password'
    })
    if (!credential) {
      throw new HTTPException(404)
    }
    await ctx.app.db.credentials.deleteOne({
      _id: credentialId
    })
    return {}
  }
}

export default definePlugin({
  name: 'password',
  configType: tPasswordConfig,
  setup: async (ctx) => {
    await ctx.app.db.credentials.createIndex(
      { userId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          type: 'password'
        }
      }
    )
    ctx.app.credential.provide(new PasswordImpl(ctx.app.config.getAll()))
  }
})
