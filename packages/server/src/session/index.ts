import { Hookable } from 'hookable'
import { BusinessError, Permission, tSecurityLevel, UAAA } from '../util/index.js'
import type {
  App,
  ICredentialLoginResult,
  ICredentialVerifyResult,
  ITokenDoc,
  ITokenEnvironment,
  ITokenPayload
} from '../index.js'
import { type } from 'arktype'
import { customAlphabet, nanoid } from 'nanoid'
import ms from 'ms'

const remoteCodeGen = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8)

export const tRemoteRequest = type({
  type: 'string',
  clientAppId: 'string',
  params: 'string',
  securityLevel: 'string',
  'confidential?': 'string',
  'permissions?': 'string',
  'optionalPermissions?': 'string'
})
export type RemoteRequest = typeof tRemoteRequest.infer

export const tRemoteResponse = type({
  'code?': 'string',
  'state?': 'string',
  'error?': 'string'
})
export type RemoteResponse = typeof tRemoteResponse.infer

export interface IRemoteEnvironment {
  remoteIp?: string
  remoteUa?: string
}

interface IRemoteState {
  authCode?: string | undefined
  request?: RemoteRequest
  response?: RemoteResponse
  environment: IRemoteEnvironment
}

export const tDeriveOptions = type({
  clientAppId: 'string',
  securityLevel: tSecurityLevel,
  'permissions?': 'string[]',
  'optionalPermissions?': 'string[]',
  'nonce?': 'string',
  'challenge?': 'string',
  'signToken?': 'boolean',
  'confidential?': 'boolean',
  'remote?': 'boolean'
})

export type DeriveOptions = typeof tDeriveOptions.infer

export class SessionManager extends Hookable<{
  preElevate(token: ITokenPayload, verifyResult: ICredentialVerifyResult): void | Promise<void>
  preDerive(token: ITokenPayload, options: DeriveOptions): void | Promise<void>
}> {
  remoteTimeout = ms('1min')
  remotePollInterval = ms('5s')

  constructor(public app: App) {
    super()
  }

  async checkUser(userId: string) {
    const count = await this.app.db.users.countDocuments({ _id: userId, disabled: { $ne: true } })
    if (!count) throw new BusinessError('NOT_FOUND', { msg: 'User not found' })
  }

  async login(loginResult: ICredentialLoginResult, environment: ITokenEnvironment) {
    const { db, token } = this.app
    const { userId, securityLevel, expiresIn, credentialId, tokenTimeout, refreshTimeout } =
      loginResult
    await this.checkUser(userId)
    const now = Date.now()
    const { insertedId: sessionId } = await db.sessions.insertOne({
      _id: nanoid(),
      userId,
      tokenCount: securityLevel > 0 ? 2 : 1,
      expiresAt: now,
      createdAt: now,
      authorizedApps: [],
      environment
    })
    const partialTokenDoc = {
      sessionId,
      userId,
      permissions: [`${UAAA}/**`],
      credentialId,
      environment
    } satisfies Partial<ITokenDoc>
    const lower = await token.createAndSignToken(
      {
        ...partialTokenDoc,
        index: 0,
        securityLevel: 0,
        createdAt: now,
        expiresAt: now + token.sessionTimeout,
        tokenTimeout: token.getTokenTimeout(0, tokenTimeout),
        refreshTimeout: token.getRefreshTimeout(0, refreshTimeout)
      },
      { generateCode: false }
    )
    if (securityLevel <= 0) return [lower]
    const upper = await token.createAndSignToken(
      {
        ...partialTokenDoc,
        index: 1,
        parentId: JSON.parse(atob(lower.token.split('.')[1])).jti,
        securityLevel,
        createdAt: now,
        expiresAt: now + token.getSessionTokenTimeout(securityLevel, expiresIn),
        tokenTimeout: token.getTokenTimeout(securityLevel, tokenTimeout),
        refreshTimeout: token.getRefreshTimeout(securityLevel, refreshTimeout)
      },
      { generateCode: false }
    )
    return [lower, upper]
  }

  async elevate(
    token: ITokenPayload,
    verifyResult: ICredentialVerifyResult,
    environment: ITokenEnvironment
  ) {
    await this.callHook('preElevate', token, verifyResult)
    const session = await this.app.db.sessions.findOneAndUpdate(
      { _id: token.sid, terminated: { $ne: true } },
      { $inc: { tokenCount: 1 } },
      { returnDocument: 'before' }
    )
    if (!session) throw new BusinessError('BAD_REQUEST', { msg: 'Session not found' })
    const now = Date.now()
    const { credentialId, securityLevel, expiresIn, tokenTimeout, refreshTimeout } = verifyResult
    const newToken = await this.app.token.createAndSignToken({
      sessionId: token.sid,
      userId: token.sub,
      permissions: [`${UAAA}/**`],
      index: session.tokenCount,
      parentId: token.jti,
      credentialId,
      securityLevel,
      createdAt: now,
      expiresAt: now + this.app.token.getSessionTokenTimeout(securityLevel, expiresIn),
      tokenTimeout: this.app.token.getTokenTimeout(securityLevel, tokenTimeout),
      refreshTimeout: this.app.token.getRefreshTimeout(securityLevel, refreshTimeout),
      environment
    })
    return { token: newToken }
  }

  async checkDerive(token: ITokenPayload, options: DeriveOptions) {
    if (token.client_id) {
      throw new BusinessError('BAD_REQUEST', {
        msg: 'Application token is not allowed to derive another token'
      })
    }

    const { clientAppId, securityLevel, confidential = true } = options
    if (securityLevel > token.level) {
      throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', { required: securityLevel })
    }

    const clientApp = await this.app.db.apps.findOne({ _id: clientAppId, disabled: { $ne: true } })
    if (!clientApp) throw new BusinessError('NOT_FOUND', { msg: 'Client app not found' })
    if (securityLevel > clientApp.securityLevel) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Security level higher than client app' })
    }
    if (!confidential && !clientApp.openid?.allowPublicClient) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Public client not allowed' })
    }

    await this.callHook('preDerive', token, options)

    const installation = await this.app.db.installations.findOne({
      userId: token.sub,
      appId: clientAppId,
      disabled: { $ne: true }
    })
    if (!installation) {
      throw new BusinessError('APP_NOT_INSTALLED', {})
    }

    const granted = new Set([
      ...installation.grantedPermissions,
      // Allow client app to request corresponding backend's permissions
      ...clientApp.providedPermissions.map((p) =>
        Permission.fromScopedString(p.path, clientApp._id).toCompactString()
      )
    ])
    if (options.permissions) {
      for (const perm of options.permissions) {
        if (!granted.has(perm)) {
          throw new BusinessError('INSUFFICIENT_PERMISSION', { required: perm })
        }
      }
    } else {
      // Default to grant all permissions
      options.permissions = installation.grantedPermissions
    }
    if (options.optionalPermissions) {
      options.permissions = [
        ...options.permissions,
        ...options.optionalPermissions.filter((p) => granted.has(p))
      ]
    }

    const permissions = options.permissions
    if (!permissions.some((p) => Permission.fromCompactString(p).appId === UAAA)) {
      throw new BusinessError('BAD_REQUEST', { msg: 'No permissions granted for UAAA' })
    }

    const timestamp = Date.now()
    const parentToken = await this.app.db.tokens.findOne({
      _id: token.jti,
      expiresAt: { $gt: timestamp },
      terminated: { $ne: true }
    })
    if (!parentToken) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Parent token not found' })
    }

    return { clientApp, installation, parentToken, permissions, timestamp }
  }

  async derive(token: ITokenPayload, options: DeriveOptions, environment: ITokenEnvironment) {
    const {
      clientAppId,
      securityLevel,
      signToken = false,
      confidential = true,
      remote = false
    } = options
    const { parentToken, permissions, timestamp } = await this.checkDerive(token, options)

    const session = await this.app.db.sessions.findOneAndUpdate(
      { _id: token.sid, terminated: { $ne: true } },
      { $inc: { tokenCount: 1 }, $addToSet: { authorizedApps: clientAppId } },
      { returnDocument: 'before' }
    )
    if (!session) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Session not found' })
    }

    const tokenDoc = await this.app.token.createToken(
      {
        sessionId: token.sid,
        userId: token.sub,
        index: session.tokenCount,
        clientAppId,
        permissions,
        parentId: parentToken._id,
        securityLevel,
        createdAt: timestamp,
        expiresAt: parentToken.expiresAt,
        // TODO: tokenTimeout and refreshTimeout should be configurable
        tokenTimeout: parentToken.tokenTimeout,
        refreshTimeout: parentToken.refreshTimeout,
        confidential,
        remote,
        nonce: options?.nonce,
        challenge: options?.challenge,
        environment
      },
      { generateCode: !signToken }
    )
    if (!signToken) {
      return { code: tokenDoc.code! }
    }
    return this.app.token.signToken(tokenDoc)
  }

  private _getRemoteState(userCode: string) {
    return this.app.cache.getx<IRemoteState>(`remote:${userCode}`)
  }

  private _setRemoteState(userCode: string, state: IRemoteState, expiresIn = this.remoteTimeout) {
    return this.app.cache.setx(`remote:${userCode}`, state, expiresIn)
  }

  async generateRemoteCode() {
    const code = remoteCodeGen()
    const userCode = code.slice(0, 4) + '-' + code.slice(4)
    const authCode = nanoid()
    return { userCode, authCode }
  }

  async activateRemoteCode(userCode: string) {
    const state = await this._getRemoteState(userCode)
    if (state && state.authCode) {
      throw new BusinessError('REMOTE_AUTH_BAD_USERCODE', {})
    }
    await this._setRemoteState(userCode, { environment: {} })
  }

  async remoteUserPoll(userCode: string) {
    const state = await this._getRemoteState(userCode)
    if (!state) throw new BusinessError('REMOTE_AUTH_EXPIRED', {})
    return { request: state.request, environment: state.environment }
  }

  async remoteAppPoll(userCode: string, authCode: string, request: RemoteRequest) {
    const state = await this._getRemoteState(userCode)
    if (state?.authCode && state.authCode !== authCode) {
      throw new BusinessError('REMOTE_AUTH_BAD_AUTHCODE', {})
    }
    if (state?.response) return state.response
    if (state && !state?.authCode) {
      // TODO: update environment
      await this._setRemoteState(userCode, { authCode, request, environment: {} })
    }
    return state ? null : undefined
  }

  async remoteUserAuthorize(userCode: string, response: RemoteResponse) {
    const state = await this._getRemoteState(userCode)
    if (!state?.authCode) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Can not response before app poll' })
    }
    await this._setRemoteState(userCode, { ...state, response })
  }
}
