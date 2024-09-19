import { Hookable } from 'hookable'
import { Context } from 'hono'
import {
  BusinessError,
  type App,
  type CredentialType,
  type ICredentialDoc,
  type ICredentialTypeMap,
  type SecurityLevel
} from '../index.js'
import { HTTPException } from 'hono/http-exception'
import type { MatchKeysAndValues } from 'mongodb'
import { nanoid } from 'nanoid'
import { ITokenDoc } from '../db/model/token.js'

export class CredentialContext {
  app
  securityLevel

  private _credentialChain?: Promise<Array<ITokenDoc & { credential: ICredentialDoc }>>

  constructor(
    public manager: CredentialManager,
    public httpCtx: Context
  ) {
    this.app = manager.app
    this.securityLevel = httpCtx.var.token?.level ?? 0
  }

  private async _getCredentialChain() {
    if (!this.httpCtx.var.token) return []
    return this.manager.getCredentialChain(this.httpCtx.var.token.jti)
  }

  getCredentialChain() {
    if (!this._credentialChain) this._credentialChain = this._getCredentialChain()
    return this._credentialChain
  }

  async getCredentialIdBlacklist(type?: CredentialType) {
    let chain = await this.getCredentialChain()
    chain = chain.slice(1)
    if (type) chain = chain.filter((token) => token.credential.type === type)
    return chain.map((token) => token.credential._id)
  }
}

export interface ICredentialLoginResult {
  /** User ID */
  userId: string
  /** Used Credential ID */
  credentialId: string
  /** Session Security Level */
  securityLevel: SecurityLevel
  expiresIn: number
}

export interface ICredentialVerifyResult {
  credentialId: string
  securityLevel: SecurityLevel
  expiresIn: number
}

export interface ICredentialBindResult {
  credentialId: string
}

export interface ICredentialUnbindResult {}

export abstract class CredentialImpl {
  abstract get type(): keyof ICredentialTypeMap

  login?(ctx: CredentialContext, payload: unknown): Promise<ICredentialLoginResult>

  async canElevate(
    ctx: CredentialContext,
    userId: string,
    targetLevel: SecurityLevel
  ): Promise<boolean> {
    const credential = await ctx.app.db.credentials.findOne({
      _id: { $nin: await ctx.getCredentialIdBlacklist(this.type) },
      userId,
      type: this.type,
      disabled: { $ne: true },
      securityLevel: { $gte: targetLevel }
    })
    return !!credential
  }

  async canBindNew(ctx: CredentialContext, userId: string): Promise<boolean> {
    return true
  }

  abstract verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: SecurityLevel,
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

  async getVerifyTypes(ctx: Context, userId: string, targetLevel: SecurityLevel) {
    const types: string[] = []
    const credentialCtx = new CredentialContext(this, ctx)
    for (const impl of Object.values(this.impls)) {
      if (await impl.canElevate(credentialCtx, userId, targetLevel)) {
        types.push(impl.type)
      }
    }
    return types
  }

  async getBindTypes(ctx: Context, userId: string) {
    const types: string[] = []
    const credentialCtx = new CredentialContext(this, ctx)
    for (const impl of Object.values(this.impls)) {
      if (await impl.canBindNew(credentialCtx, userId)) {
        types.push(impl.type)
      }
    }
    return types
  }

  async handleVerify(
    ctx: Context,
    type: string,
    userId: string,
    targetLevel: SecurityLevel,
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

  async checkCredentialUse(credentialId: string, set: MatchKeysAndValues<ICredentialDoc> = {}) {
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
        $set: { lastAccessedAt: now, ...set }
      }
    )
    if (!matchedCount) {
      throw new HTTPException(401)
    }
  }

  async bindCredential(
    ctx: CredentialContext,
    userId: string,
    credentialId: string | undefined,
    type: CredentialType,
    securityLevel: SecurityLevel,
    identifier: string | undefined,
    data: string,
    secret: unknown,
    remark: string,
    expiration: number,
    validCount: number,
    upsert: boolean = credentialId ? false : true
  ) {
    const now = Date.now()
    const credential = await ctx.app.db.credentials.findOne(
      { userId, disabled: { $ne: true } },
      { sort: { securityLevel: -1 }, projection: { securityLevel: 1 } }
    )
    const currentUserLevel = credential?.securityLevel ?? 0
    const requiredLevel = Math.min(currentUserLevel, securityLevel)
    if (ctx.securityLevel < requiredLevel) {
      throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', { required: securityLevel })
    }
    const { upsertedId } = await ctx.app.db.credentials.updateOne(
      { _id: credentialId || nanoid(), userId, type },
      {
        $setOnInsert: { createdAt: now },
        $set: {
          identifier,
          data,
          remark,
          secret,
          securityLevel,
          validAfter: now,
          validBefore: now + expiration,
          validCount,
          updatedAt: now
        },
        $unset: { disabled: '' }
      },
      { ignoreUndefined: true, upsert }
    )
    credentialId = upsertedId ?? credentialId
    if (!credentialId) throw new BusinessError('CRED_NO_BIND_NEW', {})
    return credentialId
  }

  async unbindCredential(
    ctx: CredentialContext,
    userId: string,
    credentialId: string,
    type: CredentialType
  ) {
    const loginTypes = this.getLoginTypes()
    const loginCredentialCount = await ctx.app.db.credentials.countDocuments({
      userId,
      type: { $in: loginTypes }
    })
    if (loginCredentialCount <= 1) {
      throw new BusinessError('CRED_NO_UNBIND_LAST', {})
    }

    const { deletedCount } = await ctx.app.db.credentials.deleteOne({
      _id: credentialId,
      userId,
      securityLevel: { $lte: ctx.securityLevel },
      type
    })
    if (!deletedCount) throw new BusinessError('NOT_FOUND', { msg: 'Credential not found' })
  }

  async getCredentialChain(tokenId: string) {
    const result = await this.app.db.mongoDb
      .aggregate<ITokenDoc & { credential: ICredentialDoc }>([
        { $documents: [{ parentId: tokenId }] },
        {
          $graphLookup: {
            from: 'tokens',
            startWith: '$parentId',
            connectFromField: 'parentId',
            connectToField: '_id',
            as: 'chain'
          }
        },
        { $unwind: '$chain' },
        { $replaceRoot: { newRoot: '$chain' } },
        { $sort: { index: 1 } },
        {
          $lookup: {
            from: 'credentials',
            localField: 'credentialId',
            foreignField: '_id',
            as: 'credential'
          }
        },
        { $unwind: '$credential' }
      ])
      .toArray()
    return result
  }
}
