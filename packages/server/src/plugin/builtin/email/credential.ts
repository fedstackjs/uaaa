import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { nanoid } from 'nanoid'
import ms from 'ms'
import { CredentialContext, CredentialImpl } from '../../../credential/_common.js'
import { generateUsername, SecurityLevel } from '../../../util/index.js'
import type { ICredentialUnbindResult } from '../../../index.js'
import type { EmailPlugin } from './plugin.js'

export class EmailImpl extends CredentialImpl {
  static readonly tPayload = type({
    email: 'string',
    code: 'string'
  })

  readonly type = 'email'
  defaultLevel = SecurityLevel.SL1

  constructor(public plugin: EmailPlugin) {
    super()
  }

  private async _checkPayload(ctx: CredentialContext, payload: unknown) {
    const checked = EmailImpl.tPayload(payload)
    if (checked instanceof type.errors) {
      throw new HTTPException(400, { cause: checked.summary })
    }
    await this.plugin.checkCode(this.plugin.mailKey(checked.email), checked.code)
    return { email: checked.email }
  }

  override async login(ctx: CredentialContext, payload: unknown) {
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
        securityLevel: SecurityLevel.SL1,
        expiresIn: ctx.app.token.getSessionTokenTimeout(SecurityLevel.SL1)
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
        securityLevel: SecurityLevel.SL1,
        expiresIn: ctx.app.token.getSessionTokenTimeout(SecurityLevel.SL1)
      }
    }
    throw new HTTPException(401, { message: 'User not found' })
  }

  override async canElevate(ctx: CredentialContext, userId: string, targetLevel: SecurityLevel) {
    const credential = await ctx.app.db.credentials.findOne({
      _id: { $nin: await ctx.getCredentialIdBlacklist('email') },
      userId,
      type: 'email',
      disabled: { $ne: true },
      securityLevel: { $gte: targetLevel }
    })
    return !!credential
  }

  override async canBindNew(ctx: CredentialContext, userId: string) {
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
      _id: { $nin: await ctx.getCredentialIdBlacklist('email') },
      userId,
      data: email,
      type: 'email',
      securityLevel: { $gte: targetLevel },
      disabled: { $ne: true }
    })
    if (!credential) {
      throw new HTTPException(401)
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
    await ctx.app.db.users.updateOne(
      { _id: userId },
      {
        $set: {
          'claims.email.value': email,
          'claims.email.verified': true
        }
      }
    )
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
