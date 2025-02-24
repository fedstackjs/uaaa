import { Hookable } from 'hookable'
import { BusinessError, Permission, tSecurityLevel } from '../util/index.js'
import type {
  App,
  IAppDoc,
  ICredentialLoginResult,
  ICredentialVerifyResult,
  IInstallationDoc,
  ISessionDoc,
  ITokenDoc,
  ITokenEnvironment,
  ITokenPayload,
  SecurityLevel
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

export const tExchangeOptions = type({
  clientAppId: 'string',
  securityLevel: tSecurityLevel,
  'permissions?': 'string[]',
  'optionalPermissions?': 'string[]'
})

export type ExchangeOptions = typeof tExchangeOptions.infer

export class SessionManager extends Hookable<{
  preUpgrade(
    session: ISessionDoc,
    token: ITokenDoc,
    verifyResult: ICredentialVerifyResult,
    env: ITokenEnvironment
  ): void | Promise<void>
  preDowngrade(
    session: ISessionDoc,
    token: ITokenDoc,
    targetLevel: SecurityLevel,
    env: ITokenEnvironment
  ): void | Promise<void>
  preDerive(
    session: ISessionDoc,
    token: ITokenDoc,
    options: DeriveOptions,
    env: ITokenEnvironment
  ): void | Promise<void>
  preExchange(
    session: ISessionDoc,
    token: ITokenDoc,
    options: ExchangeOptions,
    env: ITokenEnvironment
  ): void | Promise<void>
}> {
  remoteTimeout = ms('1min')
  remotePollInterval = ms('5s')

  constructor(public app: App) {
    super()
  }

  async _checkUser(userId: string) {
    const count = await this.app.db.users.countDocuments({ _id: userId, disabled: { $ne: true } })
    if (!count) throw new BusinessError('NOT_FOUND', { msg: 'User not found' })
  }

  async _getTokenOrFail(id: string) {
    const token = await this.app.db.tokens.findOne({ _id: id, terminated: { $ne: true } })
    if (!token) throw new BusinessError('BAD_REQUEST', { msg: 'Token not found' })
    return token
  }

  async _getSessionOrFail(id: string) {
    const session = await this.app.db.sessions.findOne({ _id: id, terminated: { $ne: true } })
    if (!session) throw new BusinessError('BAD_REQUEST', { msg: 'Session not found' })
    return session
  }

  async _getAppOrFail(id: string) {
    const app = await this.app.db.apps.findOne({ _id: id, disabled: { $ne: true } })
    if (!app) throw new BusinessError('NOT_FOUND', { msg: 'App not found or disabled' })
    return app
  }

  async _resolvePermissions(
    app: IAppDoc,
    installation: IInstallationDoc,
    permissions?: string[],
    optionalPermissions?: string[]
  ) {
    const granted = new Set([...installation.grantedPermissions])
    const hasPermission = (p: string) => {
      return granted.has(p) || Permission.fromCompactString(p).appId === app._id
    }
    if (permissions && permissions.some((p) => !hasPermission(p))) {
      throw new BusinessError('INSUFFICIENT_PERMISSION', {
        required: permissions.filter((p) => !hasPermission(p))
      })
    }
    const result = permissions ?? installation.grantedPermissions
    if (optionalPermissions) {
      result.push(...optionalPermissions.filter((p) => hasPermission(p)))
    }
    return result
  }

  /**
   * Create a new session and its initial session token based on the login result
   *
   * @param loginResult Result from CredentialImpl.login
   * @param environment The environment of this operation
   * @returns The created token
   */
  async login(loginResult: ICredentialLoginResult, environment: ITokenEnvironment) {
    const { db, token } = this.app
    const { userId, securityLevel, expiresIn, credentialId, tokenTimeout, refreshTimeout } =
      loginResult
    await this._checkUser(userId)
    const now = Date.now()
    const { insertedId: sessionId } = await db.sessions.insertOne({
      _id: nanoid(),
      userId,
      expiresAt: now,
      createdAt: now,
      authorizedApps: [],
      environment
    })
    return token.createAndSignToken(
      {
        userId,
        sessionId,
        clientAppId: this.app.appId,
        permissions: [`${this.app.appId}/**`],
        credentialId,
        securityLevel,
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
        expiresAt: now + token.getSessionTokenTimeout(securityLevel, expiresIn),
        tokenTimeout: token.getTokenTimeout(securityLevel, tokenTimeout),
        refreshTimeout: token.getRefreshTimeout(securityLevel, refreshTimeout),
        environment
      },
      { generateCode: false, timestamp: now }
    )
  }

  /**
   * Upgrade a session token to a higher security level
   *
   * @param jwt The jwt's payload being used to access UAAA API
   * @param verifyResult Result from CredentialImpl.verify
   * @param environment The environment of this operation
   * @returns The upgraded token
   */
  async upgrade(
    jwt: ITokenPayload,
    verifyResult: ICredentialVerifyResult,
    environment: ITokenEnvironment
  ) {
    if (jwt.client_id !== this.app.appId) {
      throw new BusinessError('BAD_REQUEST', {
        msg: 'Only session token can be upgraded'
      })
    }

    const token = await this._getTokenOrFail(jwt.jti)
    const session = await this._getSessionOrFail(token.sessionId)
    await this.callHook('preUpgrade', session, token, verifyResult, environment)

    const now = Date.now()
    const { credentialId, securityLevel, expiresIn, tokenTimeout, refreshTimeout } = verifyResult
    const newToken = await this.app.token.createAndSignToken(
      {
        sessionId: token.sessionId,
        userId: token.userId,
        clientAppId: this.app.appId,
        // Always grant session token full permissions
        permissions: [`${this.app.appId}/**`],
        parentId: token._id,
        credentialId,
        securityLevel,
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
        expiresAt: now + this.app.token.getSessionTokenTimeout(securityLevel, expiresIn),
        tokenTimeout: this.app.token.getTokenTimeout(securityLevel, tokenTimeout),
        refreshTimeout: this.app.token.getRefreshTimeout(securityLevel, refreshTimeout),
        environment
      },
      { timestamp: now }
    )
    return { token: newToken }
  }

  /**
   * Downgrade a token to a lower security level
   *
   * - The downgraded token's expire time is calculated based on the parent token's
   *   activated time and the new security level's timeout settings.
   *
   * @param jwt The jwt's payload being used to access UAAA API
   * @param targetLevel The target security level to downgrade to
   * @param environment The environment of this operation
   * @returns The downgraded token
   */
  async downgrade(jwt: ITokenPayload, targetLevel: SecurityLevel, environment: ITokenEnvironment) {
    if (targetLevel >= jwt.level) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Target level should be lower than current' })
    }

    const token = await this._getTokenOrFail(jwt.jti)
    const session = await this._getSessionOrFail(token.sessionId)
    await this.callHook('preDowngrade', session, token, targetLevel, environment)

    const now = Date.now()
    const newToken = await this.app.token.createAndSignToken(
      {
        sessionId: token.sessionId,
        userId: token.userId,
        clientAppId: this.app.appId,
        permissions: token.permissions,
        parentId: token._id,
        securityLevel: targetLevel,
        createdAt: now,
        updatedAt: now,
        activatedAt: token.activatedAt,
        expiresAt: token.activatedAt + this.app.token.getSessionTokenTimeout(targetLevel),
        tokenTimeout: this.app.token.getTokenTimeout(targetLevel),
        refreshTimeout: this.app.token.getRefreshTimeout(targetLevel),
        environment
      },
      { timestamp: now }
    )
    return { token: newToken }
  }

  /**
   * Check whether the jwt has sufficient permission to derive a new token
   *
   * @param jwt The jwt's payload being used to access UAAA API
   * @param options Derive options
   * @param environment The environment of this operation
   * @returns Data for actual derivation
   */
  async checkDerive(jwt: ITokenPayload, options: DeriveOptions, environment: ITokenEnvironment) {
    if (jwt.client_id !== this.app.appId) {
      throw new BusinessError('BAD_REQUEST', {
        msg: 'Application token is not allowed to derive another token'
      })
    }

    const { clientAppId, securityLevel, confidential = true } = options
    if (securityLevel > jwt.level) {
      throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', { required: securityLevel })
    }

    const clientApp = await this._getAppOrFail(clientAppId)
    if (securityLevel > clientApp.securityLevel) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Client App cannot hold the target level' })
    }
    if (!confidential && !clientApp.openid?.allowPublicClient) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Client App requires confidential token' })
    }

    const session = await this._getSessionOrFail(jwt.sid)
    const token = await this._getTokenOrFail(jwt.jti)
    await this.callHook('preDerive', session, token, options, environment)

    const installation = await this.app.db.installations.findOne({
      userId: token.userId,
      appId: clientAppId,
      disabled: { $ne: true }
    })
    if (!installation) {
      throw new BusinessError('APP_NOT_INSTALLED', {})
    }

    const permissions = await this._resolvePermissions(
      clientApp,
      installation,
      options.permissions,
      options.optionalPermissions
    )
    return { clientApp, installation, token, session, permissions }
  }

  /**
   * Derive App Token from Session Token
   *
   * - The derived token's expire time is calculated based on the parent token's
   *   activated time and the new security level's timeout settings, just like
   *   the downgrade operation.
   * - The derived token's permission is determined by the client app's requested
   *   permissions and the user's granted permissions.
   *
   * @param jwt The jwt's payload being used to access UAAA API
   * @param options Derive options
   * @param environment The environment of this operation
   * @returns Derived token
   */
  async derive(jwt: ITokenPayload, options: DeriveOptions, environment: ITokenEnvironment) {
    const {
      clientAppId,
      securityLevel,
      signToken = false,
      confidential = true,
      remote = false
    } = options
    const { token, session, permissions } = await this.checkDerive(jwt, options, environment)

    await this.app.db.sessions.updateOne(
      { _id: token.sessionId, terminated: { $ne: true } },
      { $addToSet: { authorizedApps: clientAppId } }
    )
    const now = Date.now()
    const tokenDoc = await this.app.token.createToken(
      {
        sessionId: token.sessionId,
        userId: token.userId,
        clientAppId,
        permissions,
        parentId: token._id,
        securityLevel,
        createdAt: now,
        updatedAt: now,
        activatedAt: token.activatedAt,
        expiresAt: token.activatedAt + this.app.token.getSessionTokenTimeout(securityLevel),
        tokenTimeout: this.app.token.getTokenTimeout(securityLevel),
        refreshTimeout: this.app.token.getRefreshTimeout(securityLevel),
        confidential,
        remote,
        nonce: options?.nonce,
        challenge: options?.challenge,
        environment
      },
      { generateCode: !signToken, timestamp: now }
    )
    if (!signToken) {
      return { code: tokenDoc.code! }
    }
    return this.app.token.signToken(tokenDoc)
  }

  /**
   * Exchange App Token from another App Token
   *
   * @param jwt The jwt's payload being used to exchange
   * @param options Exchange options
   * @param environment The environment of this operation
   */
  async exchange(jwt: ITokenPayload, options: ExchangeOptions, environment: ITokenEnvironment) {
    const { clientAppId, securityLevel } = options
    if (securityLevel > jwt.level) {
      throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', { required: securityLevel })
    }
    const clientApp = await this._getAppOrFail(clientAppId)
    if (securityLevel > clientApp.securityLevel) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Client App cannot hold the target level' })
    }
    const session = await this._getSessionOrFail(jwt.sid)
    const token = await this._getTokenOrFail(jwt.jti)
    await this.callHook('preExchange', session, token, options, environment)

    const installation = await this.app.db.installations.findOne({
      userId: token.userId,
      appId: clientAppId,
      disabled: { $ne: true }
    })
    if (!installation) {
      throw new BusinessError('APP_NOT_INSTALLED', {})
    }

    const permissions = await this._resolvePermissions(
      clientApp,
      installation,
      options.permissions,
      options.optionalPermissions
    )
    await this.app.db.sessions.updateOne(
      { _id: token.sessionId, terminated: { $ne: true } },
      { $addToSet: { authorizedApps: clientAppId } }
    )
    const now = Date.now()
    return this.app.token.createAndSignToken(
      {
        sessionId: token.sessionId,
        userId: token.userId,
        clientAppId,
        permissions,
        parentId: token._id,
        securityLevel,
        createdAt: now,
        updatedAt: now,
        activatedAt: token.activatedAt,
        expiresAt: token.activatedAt + this.app.token.getSessionTokenTimeout(securityLevel),
        tokenTimeout: this.app.token.getTokenTimeout(securityLevel),
        refreshTimeout: this.app.token.getRefreshTimeout(securityLevel),
        environment
      },
      { generateCode: false, timestamp: now }
    )
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
