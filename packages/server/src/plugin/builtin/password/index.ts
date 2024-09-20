import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import bcrypt from 'bcrypt'
import ms from 'ms'
import { definePlugin } from '../../_common.js'
import {
  CredentialContext,
  CredentialImpl,
  ICredentialUnbindResult
} from '../../../credential/_common.js'
import { SecurityLevels, BusinessError } from '../../../util/index.js'
import type { SecurityLevel } from '../../../index.js'

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
  defaultLevel = SecurityLevels.SL1
  passwordExpiration
  passwordTimeout

  constructor(config: IPasswordConfig) {
    super()
    this.passwordExpiration = this.parseTimeout(config.passwordExpiration ?? '100y')
    this.passwordTimeout = this.parseTimeout(config.passwordTimeout ?? '60min')
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
      $or: [{ 'claims.username.value': payload.id }]
    })
    if (!user) {
      throw new HTTPException(401)
    }

    const credential = await ctx.app.db.credentials.findOne({
      userId: user._id,
      type: 'password',
      disabled: { $ne: true }
    })
    if (!credential) {
      throw new HTTPException(401)
    }

    const match = await bcrypt.compare(payload.password, credential.secret as string)
    if (!match) {
      throw new HTTPException(401)
    }

    await ctx.manager.checkCredentialUse(credential._id)
    return {
      userId: user._id,
      credentialId: credential._id,
      securityLevel: SecurityLevels.SL1,
      expiresIn: this.passwordTimeout
    }
  }

  override async canElevate(ctx: CredentialContext, userId: string, targetLevel: SecurityLevel) {
    const credential = await ctx.app.db.credentials.findOne({
      _id: { $nin: await ctx.getCredentialIdBlacklist('password') },
      userId,
      type: 'password',
      disabled: { $ne: true },
      securityLevel: { $gte: targetLevel }
    })
    return !!credential
  }

  override async canBindNew(ctx: CredentialContext, userId: string) {
    const credential = await ctx.app.db.credentials.findOne({
      userId,
      type: 'password'
    })
    return !credential
  }

  override async verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: SecurityLevel,
    _payload: unknown
  ) {
    const payload = PasswordImpl.tPasswordVerifyPayload(_payload)
    if (payload instanceof type.errors) {
      throw new BusinessError('INVALID_TYPE', { summary: payload.summary })
    }
    const credential = await ctx.app.db.credentials.findOne({
      _id: { $nin: await ctx.getCredentialIdBlacklist('password') },
      userId: userId,
      type: 'password',
      securityLevel: { $gte: targetLevel },
      disabled: { $ne: true }
    })
    if (!credential) {
      throw new BusinessError('NOT_FOUND', { msg: 'Password credential not found' })
    }
    const match = await bcrypt.compare(payload.password, credential.secret as string)
    if (!match) {
      throw new BusinessError('CRED_VALIDATION_FAILED', { msg: 'Bad password' })
    }

    await ctx.manager.checkCredentialUse(credential._id)
    return {
      credentialId: credential._id,
      securityLevel: targetLevel,
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
    return {
      credentialId: await ctx.manager.bindCredential(ctx, 'password', userId, credentialId, {
        userIdentifier: '',
        data: '',
        secret: hashed,
        remark: '',
        expiration: ms('100y'),
        validCount: Number.MAX_SAFE_INTEGER,
        securityLevel: this.defaultLevel
      })
    }
  }

  override async unbind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string,
    payload: unknown
  ): Promise<ICredentialUnbindResult> {
    throw new HTTPException(403, { message: 'Cannot unbind password credential' })
  }
}

export default definePlugin({
  name: 'password',
  configType: tPasswordConfig,
  setup: async (ctx) => {
    ctx.app.credential.provide(new PasswordImpl(ctx.app.config.getAll()))
  }
})
