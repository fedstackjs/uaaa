import { Hookable } from 'hookable'
import { Context } from 'hono'
import type { App } from '../index.js'
import { HTTPException } from 'hono/http-exception'

export class CredentialContext {
  app
  securityLevel

  constructor(public manager: CredentialManager, public httpCtx: Context) {
    this.app = manager.app
    this.securityLevel = httpCtx.var.token?.level ?? 0
  }
}

export interface ICredentialLoginResult {
  /** User ID */
  userId: string
  /** Used Credential ID */
  credentialId: string
  /** Session Security Level */
  securityLevel: number
  /** Seconds */
  expiresIn: number
}

export interface ICredentialVerifyResult {
  credentialId: string
  securityLevel: number
  /** Seconds */
  expiresIn: number
}

export interface ICredentialBindResult {
  credentialId: string
}

export interface ICredentialUnbindResult {}

export abstract class CredentialImpl {
  abstract get type(): string

  login?(ctx: CredentialContext, payload: unknown): Promise<ICredentialLoginResult>

  abstract canElevate(ctx: CredentialContext, userId: string, targetLevel: number): Promise<boolean>

  abstract verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: number,
    payload: unknown
  ): Promise<ICredentialVerifyResult>

  abstract bind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string | undefined,
    payload: unknown
  ): Promise<ICredentialBindResult>

  abstract unbind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string,
    payload: unknown
  ): Promise<ICredentialUnbindResult>
}

export class CredentialManager extends Hookable<{}> {
  impls: Record<string, CredentialImpl> = Object.create(null)

  constructor(public app: App) {
    super()
  }

  provide(impl: CredentialImpl) {
    this.impls[impl.type] = impl
  }

  getLoginTypes() {
    return Object.values(this.impls)
      .filter((impl) => impl.login)
      .map((impl) => impl.type)
  }

  async handleLogin(ctx: Context, type: string, payload: unknown) {
    const impl = this.impls[type]
    if (!impl || !impl.login) {
      throw new Error('Credential type not found')
    }
    return impl.login(new CredentialContext(this, ctx), payload)
  }

  async getVerifyTypes(ctx: Context, userId: string, targetLevel: number) {
    const types: string[] = []
    for (const impl of Object.values(this.impls)) {
      if (await impl.canElevate(new CredentialContext(this, ctx), userId, targetLevel)) {
        types.push(impl.type)
      }
    }
    return types
  }

  async handleVerify(
    ctx: Context,
    type: string,
    userId: string,
    targetLevel: number,
    payload: unknown
  ) {
    const impl = this.impls[type]
    if (!impl) {
      throw new Error('Credential type not found')
    }
    return impl.verify(new CredentialContext(this, ctx), userId, targetLevel, payload)
  }

  async handleBind(
    ctx: Context,
    type: string,
    userId: string,
    credentialId: string | undefined,
    payload: unknown
  ) {
    const impl = this.impls[type]
    if (!impl) {
      throw new Error('Credential type not found')
    }
    return impl.bind(new CredentialContext(this, ctx), userId, credentialId, payload)
  }

  async handleUnbind(
    ctx: Context,
    type: string,
    userId: string,
    credentialId: string,
    payload: unknown
  ) {
    const impl = this.impls[type]
    if (!impl) {
      throw new Error('Credential type not found')
    }
    return impl.unbind(new CredentialContext(this, ctx), userId, credentialId, payload)
  }

  async checkCredentialUse(credentialId: string) {
    const now = Date.now()
    const { matchedCount } = await this.app.db.credentials.updateOne(
      {
        _id: credentialId,
        validAfter: { $lte: now },
        validBefore: { $gt: now },
        validCount: { $gt: 0 }
      },
      {
        $inc: { validCount: -1, accessedCount: 1 },
        $set: { lastAccessedAt: now }
      }
    )
    if (!matchedCount) {
      throw new HTTPException(401)
    }
  }
}
