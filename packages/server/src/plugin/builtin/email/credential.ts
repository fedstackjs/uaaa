import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { nanoid } from 'nanoid'
import ms from 'ms'
import { CredentialContext, CredentialImpl } from '../../../credential/_common.js'
import { generateUsername } from '../../../util/index.js'
import type { ICredentialUnbindResult } from '../../../index.js'
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
    const cachedCode = await ctx.app.cache.get(this.plugin.mailKey(checked.email))
    if (!cachedCode || cachedCode !== checked.code) {
      throw new HTTPException(401)
    }
    return { email: checked.email }
  }

  private async _checkPayloadAndCredential(ctx: CredentialContext, payload: unknown) {
    const { email } = await this._checkPayload(ctx, payload)
    const credential = await ctx.app.db.credentials.findOne({
      data: email,
      type: 'email'
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
      type: 'email'
    })
    if (credential) {
      return {
        userId: credential.userId,
        credentialId: credential._id,
        securityLevel: credential.securityLevel,
        expiresIn: ms(ctx.app.config.get('tokenTimeout'))
      }
    }
    if (this.plugin.allowSignupFromLogin) {
      await ctx.app.db.users.insertOne({
        _id: nanoid(),
        claims: {
          username: {
            value: generateUsername(email.split('@')[0])
          }
        },
        salt: nanoid(),
        securityLevel: ctx.app.config.get('defaultUserSecurityLevel')
      })
    }
    throw new HTTPException(401)
  }

  override async canElevate(ctx: CredentialContext, userId: string, targetLevel: number) {
    const credential = await ctx.app.db.credentials.findOne({
      userId,
      type: 'email',
      securityLevel: { $gte: targetLevel }
    })
    return !!credential
  }

  override async verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: number,
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
          securityLevel: 1,
          createdAt: now
        },
        $set: {
          data: email,
          validAfter: Date.now(),
          validBefore: Infinity,
          validCount: Infinity,
          updatedAt: now
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
  ): Promise<ICredentialUnbindResult> {
    throw new HTTPException(403, { message: 'Cannot unbind email credential' })
  }
}
