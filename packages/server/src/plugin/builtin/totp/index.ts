import { type } from 'arktype'
import ms from 'ms'
import { TOTP } from 'totp-generator'
import { definePlugin } from '../../_common.js'
import {
  CredentialContext,
  CredentialImpl,
  type ICredentialUnbindResult
} from '../../../credential/_common.js'
import { SecurityLevel, BusinessError, tSecurityLevel } from '../../../util/index.js'

const tTOTPConfig = type({
  'totpSecurityLevel?': tSecurityLevel
})

type ITOTPConfig = typeof tTOTPConfig.infer

declare module '../../../index.js' {
  interface IConfig extends ITOTPConfig {}
  interface ICredentialTypeMap {
    totp: string
  }
}

class TOTPImpl extends CredentialImpl {
  static readonly tVerifyPayload = type({
    code: 'string'
  })
  static readonly tBindPayload = type({
    code: 'string',
    secret: 'string'
  })

  readonly type = 'totp'

  newCredentialSecurityLevel

  constructor(public config: ITOTPConfig) {
    super()
    this.newCredentialSecurityLevel = config.totpSecurityLevel ?? SecurityLevel.SL3
  }

  override async canElevate(ctx: CredentialContext, userId: string, targetLevel: SecurityLevel) {
    const credential = await ctx.app.db.credentials.findOne({
      _id: { $nin: await ctx.getCredentialIdBlacklist(this.type) },
      userId,
      type: this.type,
      disabled: { $ne: true },
      securityLevel: { $gte: targetLevel }
    })
    return !!credential
  }

  override async canBindNew(ctx: CredentialContext, userId: string) {
    const credential = await ctx.app.db.credentials.findOne({
      userId,
      type: this.type
    })
    return !credential
  }

  override async verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: SecurityLevel,
    _payload: unknown
  ) {
    const payload = TOTPImpl.tVerifyPayload(_payload)
    if (payload instanceof type.errors) {
      throw new BusinessError('INVALID_TYPE', { summary: payload.summary })
    }
    const credential = await ctx.app.db.credentials.findOne({
      _id: { $nin: await ctx.getCredentialIdBlacklist(this.type) },
      userId,
      type: this.type,
      securityLevel: { $gte: targetLevel },
      disabled: { $ne: true }
    })
    if (!credential) {
      throw new BusinessError('NOT_FOUND', { msg: 'TOTP credential not found' })
    }

    if (payload.code !== TOTP.generate(credential.secret as string).otp) {
      throw new BusinessError('FORBIDDEN', { msg: 'Invalid TOTP code' })
    }

    await ctx.manager.checkCredentialUse(credential._id)
    return {
      credentialId: credential._id,
      securityLevel: targetLevel
    }
  }

  override async bind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string | undefined,
    _payload: unknown
  ) {
    const payload = TOTPImpl.tBindPayload(_payload)
    if (payload instanceof type.errors) {
      throw new BusinessError('INVALID_TYPE', { summary: payload.summary })
    }

    if (payload.code !== TOTP.generate(payload.secret).otp) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Invalid TOTP code' })
    }

    return {
      credentialId: await ctx.manager.bindCredential(ctx, 'totp', userId, credentialId, {
        userIdentifier: '',
        data: '',
        secret: payload.secret,
        remark: '',
        expiration: ms('100y'),
        validCount: Number.MAX_SAFE_INTEGER,
        securityLevel: this.newCredentialSecurityLevel
      })
    }
  }

  override async unbind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string,
    payload: unknown
  ): Promise<ICredentialUnbindResult> {
    await ctx.manager.unbindCredential(ctx, 'totp', userId, credentialId)
    return {}
  }
}

export default definePlugin({
  name: 'totp',
  configType: tTOTPConfig,
  setup: async (ctx) => {
    ctx.app.credential.provide(new TOTPImpl(ctx.app.config.getAll()))
  }
})
