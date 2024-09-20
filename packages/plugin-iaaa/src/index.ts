import {
  definePlugin,
  arktype,
  SecurityLevels,
  CredentialImpl,
  CredentialContext,
  ICredentialLoginResult,
  BusinessError,
  IUserClaims,
  SecurityLevel,
  ICredentialVerifyResult,
  ICredentialBindResult,
  ICredentialUnbindResult,
  App
} from '@uaaa/server'
import { getConnInfo } from '@hono/node-server/conninfo'
import ms from 'ms'
import { IAAAValidateResponse, validate } from './iaaa.js'
import { nanoid } from 'nanoid'

const tConfig = arktype.type({
  iaaaId: 'string',
  iaaaName: 'string',
  iaaaKey: 'string',
  iaaaRedirect: 'string',
  'iaaaAuthorize?': 'string',
  'iaaaAllowSignup?': 'boolean',
  'iaaaAllowRebind?': 'boolean',
  'iaaaEmailSuffix?': 'string',
  'iaaaEmailVerified?': 'boolean',
  'iaaaEndpoint?': 'string'
})

type IMyConfig = typeof tConfig.infer

declare module '@uaaa/server' {
  interface IConfig extends IMyConfig {}
  interface ICredentialTypeMap {
    iaaa: string
  }
  interface IClaimNames {
    'iaaa:name'?: string | undefined
    'iaaa:status'?: string | undefined
    'iaaa:identity_id'?: string | undefined
    'iaaa:dept_id'?: string | undefined
    'iaaa:dept'?: string | undefined
    'iaaa:identity_type'?: string | undefined
    'iaaa:detail_type'?: string | undefined
    'iaaa:identity_status'?: string | undefined
    'iaaa:campus'?: string | undefined
  }
}

class IAAAImpl extends CredentialImpl {
  static readonly tTokenPayload = arktype.type({
    token: 'string'
  })
  readonly type = 'iaaa'
  id
  key
  allowSignup
  allowRebind
  emailSuffix
  endpoint
  timeout

  constructor(public app: App) {
    super()
    this.id = app.config.get('iaaaId')
    this.key = app.config.get('iaaaKey')
    this.allowSignup = app.config.get('iaaaAllowSignup')
    this.allowRebind = app.config.get('iaaaAllowRebind')
    this.emailSuffix = app.config.get('iaaaEmailSuffix')
    this.endpoint =
      app.config.get('iaaaEndpoint') ?? 'https://iaaa.pku.edu.cn/iaaa/svc/token/validate.do'
    this.timeout = ms(app.config.get('tokenTimeout'))
  }

  private iaaaResponseToClaims(resp: IAAAValidateResponse): Partial<IUserClaims> {
    const claims: Partial<IUserClaims> = {
      realname: { value: resp.userInfo.name, verified: true },
      'iaaa:name': { value: resp.userInfo.name, verified: true },
      'iaaa:status': { value: resp.userInfo.status, verified: true },
      'iaaa:identity_id': { value: resp.userInfo.identityId, verified: true },
      'iaaa:dept_id': { value: resp.userInfo.deptId, verified: true },
      'iaaa:dept': { value: resp.userInfo.dept, verified: true },
      'iaaa:identity_type': { value: resp.userInfo.identityType, verified: true },
      'iaaa:detail_type': { value: resp.userInfo.detailType, verified: true },
      'iaaa:identity_status': { value: resp.userInfo.identityStatus, verified: true },
      'iaaa:campus': { value: resp.userInfo.campus, verified: true }
    }
    if (this.emailSuffix) {
      claims.email = { value: `${resp.userInfo.identityId}@${this.emailSuffix}`, verified: true }
    }
    return claims
  }

  private async updateUserClaims(
    ctx: CredentialContext,
    userId: string,
    resp: IAAAValidateResponse
  ) {
    const claims = this.iaaaResponseToClaims(resp)
    const $set = Object.fromEntries(Object.entries(claims).map(([k, v]) => [`claims.${k}`, v]))
    await ctx.app.db.users.updateOne({ _id: userId }, { $set })
  }

  override async login(ctx: CredentialContext, _payload: unknown): Promise<ICredentialLoginResult> {
    const payload = IAAAImpl.tTokenPayload(_payload)
    if (payload instanceof arktype.type.errors) {
      throw new BusinessError('INVALID_TYPE', { summary: payload.summary })
    }
    const info = getConnInfo(ctx.httpCtx)
    const resp = await validate(
      this.endpoint,
      info.remote.address ?? '',
      this.id,
      this.key,
      payload.token
    )
    if (!resp.success) {
      throw new BusinessError('BAD_REQUEST', { msg: `IAAA: ${resp.errMsg}` })
    }
    const credential = await ctx.app.db.credentials.findOne({
      type: 'iaaa',
      globalIdentifier: resp.userInfo.identityId
    })
    if (credential) {
      await ctx.manager.checkCredentialUse(credential._id)
      await this.updateUserClaims(ctx, credential.userId, resp)
      return {
        userId: credential.userId,
        credentialId: credential._id,
        securityLevel: credential.securityLevel,
        expiresIn: this.timeout
      }
    }
    if (!this.allowSignup) {
      throw new BusinessError('BAD_REQUEST', { msg: 'IAAA auth failed' })
    }
    const now = Date.now()
    const { insertedId: userId } = await ctx.app.db.users.insertOne({
      _id: nanoid(),
      claims: {
        username: { value: resp.userInfo.identityId },
        ...this.iaaaResponseToClaims(resp)
      },
      salt: nanoid()
    })
    const { insertedId: credentialId } = await ctx.app.db.credentials.insertOne({
      _id: nanoid(),
      userId,
      type: 'iaaa',
      data: resp.userInfo.identityId,
      secret: '',
      remark: '',
      validAfter: now,
      validBefore: Infinity,
      validCount: Infinity,
      createdAt: now,
      updatedAt: now,
      securityLevel: SecurityLevels.SL1
    })
    await ctx.manager.checkCredentialUse(credentialId)
    return {
      userId,
      credentialId,
      securityLevel: SecurityLevels.SL1,
      expiresIn: this.timeout
    }
  }

  override async canBindNew(ctx: CredentialContext, userId: string) {
    const credential = await ctx.app.db.credentials.findOne({
      type: 'iaaa',
      userId
    })
    return !credential
  }

  override async verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: SecurityLevel,
    _payload: unknown
  ): Promise<ICredentialVerifyResult> {
    const payload = IAAAImpl.tTokenPayload(_payload)
    if (payload instanceof arktype.type.errors) {
      throw new BusinessError('INVALID_TYPE', { summary: payload.summary })
    }
    const info = getConnInfo(ctx.httpCtx)
    const resp = await validate(
      this.endpoint,
      info.remote.address ?? '',
      this.id,
      this.key,
      payload.token
    )
    if (!resp.success) {
      throw new BusinessError('BAD_REQUEST', { msg: `IAAA: ${resp.errMsg}` })
    }
    const credential = await ctx.app.db.credentials.findOne({
      type: 'iaaa',
      globalIdentifier: resp.userInfo.identityId,
      userId,
      securityLevel: { $gte: targetLevel },
      disabled: { $ne: true }
    })
    if (!credential) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Not binded' })
    }
    await ctx.manager.checkCredentialUse(credential._id)
    await this.updateUserClaims(ctx, credential.userId, resp)
    return {
      credentialId: credential._id,
      securityLevel: credential.securityLevel,
      expiresIn: this.timeout
    }
  }

  override async bind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string | undefined,
    _payload: unknown
  ): Promise<ICredentialBindResult> {
    const payload = IAAAImpl.tTokenPayload(_payload)
    if (payload instanceof arktype.type.errors) {
      throw new BusinessError('INVALID_TYPE', { summary: payload.summary })
    }
    const info = getConnInfo(ctx.httpCtx)
    const resp = await validate(
      this.endpoint,
      info.remote.address ?? '',
      this.id,
      this.key,
      payload.token
    )
    if (!resp.success) {
      throw new BusinessError('BAD_REQUEST', { msg: `IAAA: ${resp.errMsg}` })
    }
    if (credentialId && !this.allowRebind) {
      throw new BusinessError('BAD_REQUEST', { msg: 'IAAA rebind not allowed' })
    }
    credentialId = await ctx.manager.bindCredential(ctx, 'iaaa', userId, credentialId, {
      userIdentifier: '',
      globalIdentifier: resp.userInfo.identityId,
      data: resp.userInfo.identityId,
      secret: '',
      remark: '',
      expiration: ms('100y'),
      validCount: Number.MAX_SAFE_INTEGER,
      securityLevel: SecurityLevels.SL1
    })
    await this.updateUserClaims(ctx, userId, resp)
    return { credentialId }
  }

  override async unbind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string,
    payload: unknown
  ): Promise<ICredentialUnbindResult> {
    throw new BusinessError('BAD_REQUEST', { msg: 'IAAA unbind not allowed' })
  }
}

export default definePlugin({
  name: 'iaaa',
  configType: tConfig,
  setup: async (ctx) => {
    const { app } = ctx
    const { db, credential, claim } = app

    credential.provide(new IAAAImpl(app))
    claim.addClaimDescriptor({
      name: 'iaaa:name',
      description: 'IAAA Name',
      securityLevel: SecurityLevels.SL0
    })
    claim.addClaimDescriptor({
      name: 'iaaa:status',
      description: 'IAAA Status',
      securityLevel: SecurityLevels.SL0
    })
    claim.addClaimDescriptor({
      name: 'iaaa:identity_id',
      description: 'IAAA Identity ID',
      securityLevel: SecurityLevels.SL0
    })
    claim.addClaimDescriptor({
      name: 'iaaa:dept_id',
      description: 'IAAA Department ID',
      securityLevel: SecurityLevels.SL0
    })
    claim.addClaimDescriptor({
      name: 'iaaa:dept',
      description: 'IAAA Department',
      securityLevel: SecurityLevels.SL0
    })
    claim.addClaimDescriptor({
      name: 'iaaa:identity_type',
      description: 'IAAA Identity Type',
      securityLevel: SecurityLevels.SL0
    })
    claim.addClaimDescriptor({
      name: 'iaaa:detail_type',
      description: 'IAAA Detail Type',
      securityLevel: SecurityLevels.SL0
    })
    claim.addClaimDescriptor({
      name: 'iaaa:identity_status',
      description: 'IAAA Identity Status',
      securityLevel: SecurityLevels.SL0
    })
    claim.addClaimDescriptor({
      name: 'iaaa:campus',
      description: 'IAAA Campus',
      securityLevel: SecurityLevels.SL0
    })
    app.hook('extendApp', (router) => {
      router.get('/.well-known/iaaa-configuration', async (ctx) => {
        return ctx.json({
          appID: app.config.get('iaaaId'),
          appName: app.config.get('iaaaName'),
          redirectUrl: app.config.get('iaaaRedirect'),
          authorizeUrl: app.config.get('iaaaAuthorize') ?? 'https://iaaa.pku.edu.cn/iaaa/oauth.jsp'
        })
      })
    })
  }
})
