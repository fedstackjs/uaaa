import ms from 'ms'
import jwt from 'jsonwebtoken'
import { createHash } from 'node:crypto'
import { Type, type } from 'arktype'
import type { Context } from 'hono'
import type { App, ClaimName, IAppDoc, IUserClaims } from '../index.js'
import { OAuthError } from './_errors.js'
import { tRemoteRequest, type RemoteRequest } from '../session/index.js'
import { isSecurityLevel, Permission, rAppId, SECURITY_LEVEL } from '../util/index.js'

export interface IOAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number | undefined
  refresh_token?: string | undefined
  scope?: string | undefined
}

type GrantFn<T> = (
  ctx: Context,
  request: T,
  client: {
    id: string
    secret: string
    app: IAppDoc
  }
) => Promise<IOAuthTokenResponse>

export class OAuthManager {
  static tAuthorizationRequest = type({
    scope: 'string',
    response_type: "'code' | 'id_token' | 'id_token token'",
    client_id: 'string',
    redirect_uri: 'string',
    'state?': 'string'
  })
  static tTokenRequest = type({
    grant_type: 'string',
    'client_id?': 'string',
    'client_secret?': 'string'
  })
  static tDeviceCodeRequest = type({
    'client_id?': 'string',
    'client_secret?': 'string',
    'scope?': 'string'
  })
  static tDeviceToken = type({
    authCode: 'string',
    userCode: 'string',
    clientId: 'string',
    request: tRemoteRequest,
    exp: 'number',
    iat: 'number'
  })

  private _base
  private _grants: Record<string, GrantFn<any>> = Object.create(null)
  private _deviceTimeout = ms('1min')
  private _devicePollInterval = ms('5s')

  constructor(public app: App) {
    this._base = app.config.get('deploymentUrl')
    const { db } = app
    const { tokens, sessions } = db

    // RFC6749 4.1
    this.defineGrant(
      'authorization_code',
      type({
        grant_type: "'authorization_code'",
        'client_id?': 'string',
        'client_secret?': 'string',
        'code_verifier?': 'string',
        code: 'string',
        'redirect_uri?': 'string|undefined'
      }),
      async (ctx, request, client) => {
        const tokenDoc = await tokens.findOneAndUpdate(
          {
            code: request.code,
            clientAppId: client.id,
            terminated: { $ne: true }
          },
          { $unset: { code: '', challenge: '' } },
          { returnDocument: 'before' }
        )
        if (!tokenDoc) {
          throw new OAuthError('invalid_grant', { description: 'Bad code' })
        }

        if (tokenDoc.confidential) {
          if (client.app.secret !== client.secret) {
            throw new OAuthError('invalid_client')
          }
          // For confidential clients, PKCE is optional
          tokenDoc.challenge &&
            this._checkClientPKCE(ctx, tokenDoc.challenge, request.code_verifier)
        } else {
          // For public clients, PKCE is required
          this._checkClientPKCE(ctx, tokenDoc.challenge, request.code_verifier)
        }

        if (request.redirect_uri && !client.app.callbackUrls.includes(request.redirect_uri)) {
          throw new OAuthError('invalid_grant', { description: 'Bad redirect_uri' })
        }

        const session = await sessions.findOne({
          _id: tokenDoc.sessionId,
          terminated: { $ne: true }
        })
        if (!session) {
          throw new OAuthError('invalid_grant', { description: 'Session not found' })
        }

        const { token, refreshToken } = await app.token.signToken(tokenDoc)
        ctx.set('token', JSON.parse(atob(token.split('.')[1])))

        let id_token: string | undefined

        const matchedPermissions = tokenDoc.permissions
          .map((p) => Permission.fromScopedString(p, this.app.appId))
          .filter((p) => p.test('/session/claim'))
        if (matchedPermissions.length) {
          id_token = await this.generateIDToken(ctx, client.id, tokenDoc.userId, tokenDoc.nonce)
        }
        return {
          access_token: token,
          token_type: 'Bearer',
          expires_in: Math.floor((tokenDoc.expiresAt - Date.now()) / 1000),
          id_token,
          refresh_token: refreshToken
        }
      }
    )

    this.defineGrant(
      'refresh_token',
      type({
        grant_type: "'refresh_token'",
        'client_id?': 'string',
        'client_secret?': 'string',
        refresh_token: 'string',
        'scope?': 'string|undefined',
        'target_app_id?': type('string').narrow((id) => rAppId.test(id))
      }),
      async (ctx, { refresh_token, scope, target_app_id }, client) => {
        const { token, refreshToken } = await ctx.var.app.token.refreshToken(
          refresh_token,
          client,
          target_app_id
        )
        return {
          access_token: token,
          token_type: 'Bearer',
          expires_in: JSON.parse(atob(token.split('.')[1])).exp - Math.floor(Date.now() / 1000),
          refresh_token: refreshToken
        }
      }
    )

    this.defineGrant(
      'urn:ietf:params:oauth:grant-type:device_code',
      type({
        grant_type: "'urn:ietf:params:oauth:grant-type:device_code'",
        device_code: 'string',
        'client_id?': 'string',
        'client_secret?': 'string'
      }),
      async (ctx, { device_code }, client) => {
        const { payload: _payload } = await app.token.verify(device_code, (err) => {
          if (err instanceof jwt.TokenExpiredError) return new OAuthError('expired_token')
          return new OAuthError('invalid_grant')
        })
        const payload = OAuthManager.tDeviceToken(_payload)
        if (payload instanceof type.errors) {
          throw new OAuthError('invalid_grant')
        }
        const { authCode, userCode, clientId, request } = payload
        if (clientId !== client.id) {
          throw new OAuthError('invalid_grant')
        }
        const response = await this.app.session.remoteAppPoll(userCode, authCode, request)
        if (!response) {
          throw new OAuthError('authorization_pending')
        }
        if (!response.code) {
          throw new OAuthError('access_denied')
        }
        const tokenDoc = await tokens.findOneAndUpdate(
          {
            code: response.code,
            clientAppId: client.id,
            remote: true,
            terminated: { $ne: true }
          },
          { $unset: { code: '', challenge: '' } },
          { returnDocument: 'before' }
        )
        if (!tokenDoc) {
          throw new OAuthError('invalid_grant', { description: 'Bad code' })
        }

        if (tokenDoc.confidential) {
          if (client.app.secret !== client.secret) {
            throw new OAuthError('invalid_client')
          }
        }

        const session = await sessions.findOne({
          _id: tokenDoc.sessionId,
          terminated: { $ne: true }
        })
        if (!session) {
          throw new OAuthError('invalid_grant', { description: 'Session not found' })
        }

        const { token, refreshToken } = await app.token.signToken(tokenDoc)
        ctx.set('token', JSON.parse(atob(token.split('.')[1])))

        let id_token: string | undefined

        const matchedPermissions = tokenDoc.permissions
          .map((p) => Permission.fromScopedString(p, this.app.appId))
          .filter((p) => p.test('/session/claim'))
        if (matchedPermissions.length) {
          id_token = await this.generateIDToken(ctx, client.id, tokenDoc.userId, tokenDoc.nonce)
        }
        return {
          access_token: token,
          token_type: 'Bearer',
          expires_in: Math.floor((tokenDoc.expiresAt - Date.now()) / 1000),
          id_token,
          refresh_token: refreshToken
        }
      }
    )
  }

  private _relativeUrl(path: string) {
    return new URL(path, this._base).toString().replace(/\?$/, '')
  }

  private _authorizeUrl(...params: ConstructorParameters<typeof URLSearchParams>) {
    return this._relativeUrl('/authorize?' + new URLSearchParams(...params).toString())
  }

  private _deviceUrl(...params: ConstructorParameters<typeof URLSearchParams>) {
    return this._relativeUrl('/remote?' + new URLSearchParams(...params).toString())
  }

  async getMetadata() {
    return {
      issuer: this._base,
      authorization_endpoint: this._relativeUrl('/oauth/authorize'),
      token_endpoint: this._relativeUrl('/oauth/token'),
      jwks_uri: this._relativeUrl('/api/public/jwks'),
      userinfo_endpoint: this._relativeUrl('/oauth/userinfo'),
      response_types_supported: ['code', 'id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256']
    }
  }

  scopeToPermissions(scope: string) {
    const scopes = scope
      .split(' ')
      .map((s) => decodeURIComponent(s))
      .filter((s) => URL.canParse(s))
      .map((s) => new URL(s))
      .filter((s) => ['uperm:', 'uperm+optional:'].includes(s.protocol))

    const permissions = scopes
      .filter((s) => s.protocol === 'uperm:')
      .map((s) => Permission.fromFullURL(s).toCompactString())
    const optionalPermissions = scopes
      .filter((s) => s.protocol === 'uperm+optional:')
      .map((s) => Permission.fromFullURL(s).toCompactString())
    return {
      permissions: permissions.length ? JSON.stringify(permissions) : '',
      optionalPermissions: optionalPermissions.length ? JSON.stringify(optionalPermissions) : ''
    }
  }

  async authorizeToUI(ctx: Context, _request: Record<string, string>) {
    const request = OAuthManager.tAuthorizationRequest(_request)
    if (request instanceof type.errors) {
      return this._authorizeUrl({ type: 'oidc', error: 'invalid_request' })
    }

    const { client_id, scope, ...rest } = request
    const clientApp = await this.app.db.apps.findOne({ _id: client_id })
    if (!clientApp) {
      return this._authorizeUrl({ type: 'oidc', error: 'invalid_client' })
    }
    const securityLevel =
      this._checkSecurityLevel('security_level' in rest && rest.security_level) ??
      this._checkSecurityLevel(clientApp.openid?.minSecurityLevel) ??
      '1'
    return this._authorizeUrl({
      clientAppId: client_id,
      type: 'oidc',
      params: JSON.stringify(rest),
      securityLevel,
      ...this.scopeToPermissions(scope)
    })
  }

  generateAdditionalClaim(claims: Partial<IUserClaims>, template: string) {
    // template format:
    // 1. plain: ${claimName}
    // 2. default: ${claimName|defaultValue}
    return template.replace(/\${([^}]+)}/g, (_, claimName) => {
      const [name, defaultValue] = claimName.split('|')
      const replaced = claims[name as ClaimName]?.value ?? defaultValue
      if (typeof replaced !== 'string') {
        throw new OAuthError('invalid_client', { description: `Claim ${name} not found` })
      }
      return replaced
    })
  }

  async generateClaims(ctx: Context, appId: string, userId: string) {
    const installation = await this.app.db.installations.findOne({
      appId,
      userId,
      disabled: { $ne: true }
    })
    const clientApp = await this.app.db.apps.findOne({ _id: appId, disabled: { $ne: true } })
    const user = await this.app.db.users.findOne({ _id: userId })
    if (!installation || !clientApp || !user) {
      throw new OAuthError('invalid_client', { description: 'Installation not found' })
    }
    const claims = await this.app.claim.filterClaimsForApp(
      ctx,
      installation.grantedClaims,
      clientApp.requestedClaims,
      user.claims
    )

    const mappedClaims = Object.create(null)
    mappedClaims['sub'] = userId

    for (const [key, value] of Object.entries(claims)) {
      const descriptor = this.app.claim.getClaimDescriptor(key as ClaimName)
      const alias = descriptor.openid?.alias ?? key
      mappedClaims[alias] = value?.value
      if (value?.verified && descriptor.openid?.verifiable) mappedClaims[`${alias}_verified`] = true
    }

    const additionalClaims = this.app.config.get('openidAdditionalClaims') ?? {}
    for (const [key, value] of Object.entries(additionalClaims)) {
      mappedClaims[key] = this.generateAdditionalClaim(claims, value)
    }

    if (clientApp.openid?.additionalClaims) {
      const additionalClaims = clientApp.openid?.additionalClaims
      for (const [key, value] of Object.entries(additionalClaims)) {
        mappedClaims[key] = this.generateAdditionalClaim(claims, value)
      }
    }
    return mappedClaims
  }

  async generateIDToken(ctx: Context, appId: string, userId: string, nonce?: string) {
    const { app } = ctx.var
    const mappedClaims = await this.generateClaims(ctx, appId, userId)
    const now = Date.now()
    return app.token.sign({
      ...mappedClaims,
      aud: appId,
      // TODO: configure this timeout
      exp: now + ctx.var.app.token.getSessionTokenTimeout(SECURITY_LEVEL.LOW),
      iat: now,
      nonce
    })
  }

  private _checkPKCEChallenge(codeVerifier: string, storedChallenge?: string) {
    if (!storedChallenge) return false
    const [method, challenge] = storedChallenge.split(':')
    switch (method) {
      case 'S256':
        return challenge === createHash('sha256').update(codeVerifier).digest('base64url')
      case 'plain':
        return challenge === codeVerifier
      default:
        return false
    }
  }

  private _checkClientPKCE(ctx: Context, challenge?: string, codeVerifier?: string) {
    if (!codeVerifier || !this._checkPKCEChallenge(codeVerifier, challenge)) {
      throw new OAuthError('invalid_client')
    }
  }

  // RFC6749 Section 2.3.1
  loadClientPassword(
    ctx: Context,
    clientId?: string,
    clientSecret?: string
  ): { clientId: string; clientSecret: string } {
    const authorization = ctx.req.header('authorization')
    if (authorization) {
      const [type, token] = authorization.split(' ')
      if (type !== 'Basic') {
        throw new OAuthError('invalid_client')
      }
      const [_id, _secret = ''] = Buffer.from(token, 'base64').toString().split(':')
      clientId ??= _id
      clientSecret ??= _secret
      if (clientId !== _id || clientSecret !== _secret) {
        throw new OAuthError('invalid_client')
      }
      return { clientId, clientSecret }
    } else {
      if (!clientId) {
        throw new OAuthError('invalid_client')
      }
      clientSecret ??= ''
      return { clientId, clientSecret }
    }
  }

  defineGrant<
    T extends (input: unknown) => unknown,
    R extends Exclude<ReturnType<T>, type.errors>,
    G extends R extends { grant_type: string } ? R['grant_type'] : never
  >(grant_type: G, request_type: T, fn: GrantFn<R>) {
    this._grants[grant_type] = (ctx, request, client) => {
      const data = request_type(request)
      if (data instanceof type.errors) {
        throw new OAuthError('invalid_request')
      }
      return fn(ctx, data as R, client)
    }
  }

  async handleTokenRequest(ctx: Context, _request: Record<string, string>) {
    const request = OAuthManager.tTokenRequest(_request)
    if (request instanceof type.errors) {
      throw new OAuthError('invalid_request')
    }
    const { grant_type, client_id, client_secret } = request
    const { clientId, clientSecret } = this.loadClientPassword(ctx, client_id, client_secret)
    const clientApp = await this.app.db.apps.findOne({ _id: clientId })
    if (!clientApp) {
      throw new OAuthError('invalid_client')
    }

    if (Object.hasOwn(this._grants, grant_type)) {
      return this._grants[grant_type](ctx, request, {
        id: clientId,
        secret: clientSecret,
        app: clientApp
      })
    }
    throw new OAuthError('unsupported_grant_type')
  }

  _checkSecurityLevel(level: unknown) {
    if (typeof level === 'string' && isSecurityLevel(parseInt(level))) return level
    return null
  }

  async handleDeviceCodeRequest(ctx: Context, _request: Record<string, string>) {
    const request = OAuthManager.tDeviceCodeRequest(_request)
    if (request instanceof type.errors) {
      throw new OAuthError('invalid_request')
    }
    const { client_id, client_secret, scope, ...rest } = request
    const { clientId } = this.loadClientPassword(ctx, client_id, client_secret)
    const clientApp = await this.app.db.apps.findOne({ _id: clientId })
    if (!clientApp) {
      throw new OAuthError('invalid_client')
    }
    const { userCode, authCode } = await this.app.session.generateRemoteCode()
    const verificationUri = this._deviceUrl()
    const verificationUriComplete = this._deviceUrl({ user_code: userCode })
    const expiresIn = Math.floor(this._deviceTimeout / 1000)
    const interval = Math.floor(this._devicePollInterval / 1000)
    const securityLevel =
      this._checkSecurityLevel('security_level' in rest && rest.security_level) ??
      this._checkSecurityLevel(clientApp.openid?.minSecurityLevel) ??
      '1'

    const remoteRequest: RemoteRequest = {
      clientAppId: clientId,
      type: 'oidc',
      params: JSON.stringify(rest),
      securityLevel,
      confidential: '0',
      ...this.scopeToPermissions(scope ?? '')
    }
    const deviceCode = await this.app.token.sign(
      { authCode, userCode, clientId, request: remoteRequest } satisfies Omit<
        typeof OAuthManager.tDeviceToken.infer,
        'exp' | 'iat'
      >,
      { audience: clientId, expiresIn: this._deviceTimeout }
    )
    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: verificationUriComplete,
      expires_in: expiresIn,
      interval
    }
  }

  async handleUserInfoRequest(ctx: Context) {
    if (!ctx.var.token.client_id) {
      ctx.status(401)
      ctx.header('WWW-Authenticate', 'error="invalid_token", error_description="Bad Token"')
      return ctx.body('')
    }
    return this.generateClaims(ctx, ctx.var.token.client_id, ctx.var.token.sub)
  }
}
