import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { nanoid } from 'nanoid'
import ms from 'ms'
import { CredentialContext, CredentialImpl } from '../../../credential/_common.js'
import { BusinessError, generateUsername, SECURITY_LEVEL } from '../../../util/index.js'
import type { ICredentialUnbindResult, SecurityLevel } from '../../../index.js'
import type { EmailPlugin } from './plugin.js'

export class EmailImpl extends CredentialImpl {
  static readonly tPayload = type({
    email: 'string',
    code: 'string'
  })

  readonly type = 'email'
  defaultLevel = SECURITY_LEVEL.MEDIUM
  loginType

  constructor(public plugin: EmailPlugin) {
    super()
    this.loginType = plugin.config.emailLogin ?? 'enabled'
  }

  private async _checkPayload(ctx: CredentialContext, payload: unknown) {
    const checked = EmailImpl.tPayload(payload)
    if (checked instanceof type.errors) {
      throw new BusinessError('BAD_REQUEST', { msg: checked.summary })
    }
    await this.plugin.checkCode(this.plugin.mailKey(checked.email), checked.code)
    return { email: checked.email }
  }

  override async showLogin(ctx: CredentialContext): Promise<boolean> {
    if (this.loginType !== 'enabled') return false
    return super.showLogin(ctx)
  }

  override async login(ctx: CredentialContext, payload: unknown) {
    if (this.loginType === 'disabled') {
      throw new BusinessError('FORBIDDEN', { msg: 'Email login is disabled' })
    }
    const { email } = await this._checkPayload(ctx, payload)
    const credential = await ctx.app.db.credentials.findOne({
      data: email,
      type: 'email',
      disabled: { $ne: true }
    })
    if (credential) {
      await ctx.manager.checkCredentialUse(credential._id)
      return {
        userId: credential.userId,
        credentialId: credential._id,
        securityLevel: credential.securityLevel
      }
    }
    if (this.plugin.allowSignupFromLogin) {
      const now = Date.now()
      const { insertedId: userId } = await ctx.app.db.users.insertOne({
        _id: nanoid(),
        claims: {
          username: { value: generateUsername(email.split('@')[0]) },
          email: { value: email, verified: true }
        },
        salt: nanoid()
      })
      const { insertedId: credentialId } = await ctx.app.db.credentials.insertOne({
        _id: nanoid(),
        globalIdentifier: email,
        userIdentifier: '',
        userId: userId,
        type: 'email',
        data: email,
        secret: '',
        remark: '',
        validAfter: now,
        validBefore: now + ms('100y'),
        validCount: Number.MAX_SAFE_INTEGER,
        createdAt: now,
        updatedAt: now,
        securityLevel: this.defaultLevel
      })
      await ctx.manager.checkCredentialUse(credentialId)
      return {
        userId,
        credentialId,
        securityLevel: this.defaultLevel
      }
    }
    throw new BusinessError('NOT_FOUND', { msg: 'User not found' })
  }

  override async showElevate(ctx: CredentialContext, userId: string, targetLevel: SecurityLevel) {
    const credential = await ctx.app.db.credentials.findOne({
      userId,
      type: 'email',
      disabled: { $ne: true },
      securityLevel: { $gte: targetLevel }
    })
    return !!credential
  }

  override async showBindNew(ctx: CredentialContext, userId: string) {
    const credential = await ctx.app.db.credentials.findOne({
      userId,
      type: 'email'
    })
    return !credential
  }

  override async verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: SecurityLevel,
    payload: unknown
  ) {
    const { email } = await this._checkPayload(ctx, payload)
    const credential = await ctx.app.db.credentials.findOne({
      userId,
      data: email,
      type: 'email',
      securityLevel: { $gte: targetLevel },
      disabled: { $ne: true }
    })
    if (!credential) {
      throw new BusinessError('NOT_FOUND', { msg: 'Email credential not found' })
    }
    await ctx.manager.checkCredentialUse(credential._id)

    return {
      credentialId: credential._id,
      securityLevel: targetLevel,
      expiresIn: ms('1d')
    }
  }

  override async bind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string | undefined,
    _payload: unknown
  ) {
    const { email } = await this._checkPayload(ctx, _payload)
    await ctx.app.db.users.updateOne({ _id: userId }, [
      {
        $set: {
          'claims.email': {
            $cond: {
              if: { $ne: ['$claims.email.verified', true] },
              then: { value: email, verified: true },
              else: '$claims.email'
            }
          }
        }
      }
    ])
    return {
      credentialId: await ctx.manager.bindCredential(ctx, 'email', userId, credentialId, {
        userIdentifier: '',
        globalIdentifier: email,
        data: email,
        secret: '',
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
    _payload: unknown
  ): Promise<ICredentialUnbindResult> {
    const { email } = await this._checkPayload(ctx, _payload)
    await ctx.app.db.users.updateOne(
      { _id: userId, 'claims.email.value': email },
      { $set: { 'claims.email.verified': false } }
    )
    await ctx.manager.unbindCredential(ctx, 'email', userId, credentialId)
    return {}
  }
}
