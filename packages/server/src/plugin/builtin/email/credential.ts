import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { nanoid } from 'nanoid'
import ms from 'ms'
import { CredentialContext, CredentialImpl } from '../../../credential/_common.js'
import { generateUsername } from '../../../util/index.js'
import type { ICredentialUnbindResult, SecurityLevel } from '../../../index.js'
import type { EmailPlugin } from './plugin.js'

export class EmailImpl extends CredentialImpl {
  static readonly tPayload = type({
    email: 'string',
    code: 'string'
  })

  readonly type = 'email'

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

  private async _checkPayloadAndCredential(ctx: CredentialContext, payload: unknown) {
    const { email } = await this._checkPayload(ctx, payload)
    const credential = await ctx.app.db.credentials.findOne({
      data: email,
      type: 'email',
      disabled: { $ne: true }
    })
    if (!credential) {
      throw new HTTPException(401)
    }
    return { credential }
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
        securityLevel: credential.securityLevel,
        expiresIn: ms(ctx.app.config.get('tokenTimeout'))
      }
    }
    if (this.plugin.allowSignupFromLogin) {
      const now = Date.now()
      const { insertedId: userId } = await ctx.app.db.users.insertOne({
        _id: nanoid(),
        claims: {
          username: {
            value: generateUsername(email.split('@')[0])
          }
        },
        salt: nanoid(),
        securityLevel: ctx.app.config.get('defaultUserSecurityLevel')
      })
      const { insertedId: credentialId } = await ctx.app.db.credentials.insertOne({
        _id: nanoid(),
        userId: userId,
        type: 'email',
        data: email,
        secret: '',
        remark: '',
        validAfter: now,
        validBefore: Infinity,
        validCount: Infinity,
        createdAt: now,
        updatedAt: now,
        securityLevel: 1
      })
      await ctx.manager.checkCredentialUse(credentialId)
      return {
        userId,
        credentialId,
        securityLevel: 1,
        expiresIn: ms(ctx.app.config.get('tokenTimeout'))
      }
    }
    throw new HTTPException(401, { message: 'User not found' })
  }

  override async canElevate(ctx: CredentialContext, userId: string, targetLevel: SecurityLevel) {
    const credential = await ctx.app.db.credentials.findOne({
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
    _payload: unknown
  ) {
    const { credential } = await this._checkPayloadAndCredential(ctx, _payload)

    return {
      credentialId: credential._id,
      securityLevel: credential.securityLevel,
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
    const now = Date.now()
    const { upsertedId } = await ctx.app.db.credentials.updateOne(
      {
        _id: credentialId as string,
        userId,
        type: 'email'
      },
      {
        $setOnInsert: {
          _id: nanoid(),
          secret: '',
          remark: '',
          // TODO: securityLevel
          securityLevel: 1,
          createdAt: now
        },
        $set: {
          data: email,
          validAfter: Date.now(),
          validBefore: Infinity,
          validCount: Infinity,
          updatedAt: now
        },
        $unset: {
          disabled: ''
        }
      },
      { ignoreUndefined: true, upsert: true }
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
  ): Promise<ICredentialUnbindResult> {
    throw new HTTPException(403, { message: 'Cannot unbind email credential' })
  }
}
