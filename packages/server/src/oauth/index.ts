import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { type Context, Hono } from 'hono'
import { verifyAuthorizationJwt, verifyPermission } from '../api/_middleware.js'
import type { ClaimName } from '../claim/_common.js'
import type { IAppDoc, IUserClaims } from '../db/index.js'
import { UAAA, BusinessError, Permission, SecurityLevel, logger } from '../util/index.js'
import { createHash } from 'crypto'
import { HTTPException } from 'hono/http-exception'

const tOpenIdAuthorizationRequest = type({
  scope: 'string',
  response_type: "'code' | 'id_token' | 'id_token token'",
  client_id: 'string',
  redirect_uri: 'string',
  'state?': 'string'
})

const AccessTokenRequest = type({
  grant_type: "'authorization_code'",
  'client_id?': 'string',
  'client_secret?': 'string',
  'code_verifier?': 'string',
  code: 'string',
  'redirect_uri?': 'string|undefined'
})
const AccessTokenRefreshRequest = type({
  grant_type: "'refresh_token'",
  'client_id?': 'string',
  'client_secret?': 'string',
  refresh_token: 'string',
  'scope?': 'string|undefined'
})

const tOpenIdAccessTokenRequest = type(AccessTokenRequest, '|', AccessTokenRefreshRequest)

function generateAdditionalClaim(claims: Partial<IUserClaims>, template: string) {
  // template format:
  // 1. plain: ${claimName}
  // 2. default: ${claimName|defaultValue}
  return template.replace(/\${([^}]+)}/g, (_, claimName) => {
    const [name, defaultValue] = claimName.split('|')
    const replaced = claims[name as ClaimName]?.value ?? defaultValue
    if (typeof replaced !== 'string') {
      throw new BusinessError('BAD_REQUEST', {
        msg: `Claim ${name} not provided`
      })
    }
    return replaced
  })
}

async function generateClaims(ctx: Context, appId: string, userId: string) {
  const { app } = ctx.var
  const installation = await app.db.installations.findOne({
    appId,
    userId,
    disabled: { $ne: true }
  })
  const clientApp = await app.db.apps.findOne({ _id: appId, disabled: { $ne: true } })
  const user = await app.db.users.findOne({ _id: userId })
  if (!installation || !clientApp || !user) {
    throw new BusinessError('NOT_FOUND', { msg: 'Installation not found' })
  }
  const claims = await app.claim.filterClaimsForApp(
    ctx,
    installation.grantedClaims,
    clientApp.requestedClaims,
    user.claims
  )

  const mappedClaims = Object.create(null)
  mappedClaims['sub'] = userId

  for (const [key, value] of Object.entries(claims)) {
    const descriptor = app.claim.getClaimDescriptor(key as ClaimName)
    const alias = descriptor.openid?.alias ?? key
    mappedClaims[alias] = value?.value
    if (value?.verified && descriptor.openid?.verifiable) mappedClaims[`${alias}_verified`] = true
  }

  const additionalClaims = ctx.var.app.config.get('openidAdditionalClaims') ?? {}
  for (const [key, value] of Object.entries(additionalClaims)) {
    mappedClaims[key] = generateAdditionalClaim(claims, value)
  }

  if (clientApp.openid?.additionalClaims) {
    const additionalClaims = clientApp.openid?.additionalClaims
    for (const [key, value] of Object.entries(additionalClaims)) {
      mappedClaims[key] = generateAdditionalClaim(claims, value)
    }
  }
  return mappedClaims
}

async function generateIDToken(ctx: Context, appId: string, userId: string, nonce?: string) {
  const { app } = ctx.var
  const mappedClaims = await generateClaims(ctx, appId, userId)
  const now = Date.now()
  return app.token.sign({
    ...mappedClaims,
    aud: appId,
    exp: now + ctx.var.app.token.getSessionTokenTimeout(SecurityLevel.SL1),
    iat: now,
    nonce
  })
}

function checkPKCEChallenge(codeVerifier: string, storedChallenge?: string) {
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

export const oauthWellKnownRouter = new Hono()
  // OIDC Discovery
  // https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig
  .get('/openid-configuration', async (ctx) => {
    const base = ctx.var.app.config.get('deploymentUrl')
    return ctx.json({
      issuer: base,
      authorization_endpoint: new URL('/oauth/authorize', base).toString(),
      token_endpoint: new URL('/oauth/token', base).toString(),
      jwks_uri: new URL('/api/public/jwks', base).toString(),
      userinfo_endpoint: new URL('/oauth/userinfo', base).toString(),
      response_types_supported: ['code', 'id_token', 'id_token token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256']
    })
  })

// RFC6749 Section 2.3.1
function loadClientPassword(
  ctx: Context,
  clientId?: string,
  clientSecret?: string
): { clientId: string; clientSecret: string } {
  const authorization = ctx.req.header('authorization')
  if (authorization) {
    const [type, token] = authorization.split(' ')
    if (type !== 'Basic') {
      throw new HTTPException(400, { res: ctx.text('invalid_client') })
    }
    const [_id, _secret = ''] = Buffer.from(token, 'base64').toString().split(':')
    clientId ??= _id
    clientSecret ??= _secret
    if (clientId !== _id || clientSecret !== _secret) {
      throw new HTTPException(400, { res: ctx.text('invalid_client') })
    }
    return { clientId, clientSecret }
  } else {
    if (!clientId) {
      throw new HTTPException(400, { res: ctx.text('invalid_client') })
    }
    clientSecret ??= ''
    return { clientId, clientSecret }
  }
}

function checkClientSecret(ctx: Context, app: IAppDoc, clientSecret: string) {
  if (clientSecret) {
    if (app.secret !== clientSecret) {
      throw new HTTPException(400, { res: ctx.text('invalid_client') })
    }
  } else {
    if (!app.openid?.allowPublicClient) {
      throw new HTTPException(400, { res: ctx.text('invalid_client') })
    }
  }
}

function checkClientPKCE(ctx: Context, challenge?: string, codeVerifier?: string) {
  if (!codeVerifier || !checkPKCEChallenge(codeVerifier, challenge)) {
    throw new HTTPException(400, { res: ctx.text('invalid_client') })
  }
}

function getAuthorizeUrl(base: string, ...params: ConstructorParameters<typeof URLSearchParams>) {
  return new URL('/authorize?' + new URLSearchParams(...params).toString(), base).toString()
}

export const oauthRouter = new Hono()
  // OIDC Authorization Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#AuthorizationEndpoint
  .get('/authorize', arktypeValidator('query', tOpenIdAuthorizationRequest), async (ctx) => {
    const { db, config } = ctx.var.app
    const base = config.get('deploymentUrl')
    const { client_id, ...rest } = ctx.req.valid('query')

    const clientApp = await db.apps.findOne({ _id: client_id })
    if (!clientApp) {
      return ctx.redirect(getAuthorizeUrl(base, { type: 'oidc', error: 'invalid_client' }))
    }
    return ctx.redirect(
      getAuthorizeUrl(base, {
        clientAppId: client_id,
        type: 'oidc',
        params: JSON.stringify(rest),
        securityLevel: '' + (clientApp.openid?.minSecurityLevel ?? '0')
      })
    )
  })
  .post('/authorize', arktypeValidator('form', tOpenIdAuthorizationRequest), async (ctx) => {
    const { db, config } = ctx.var.app
    const base = config.get('deploymentUrl')
    const { client_id, ...rest } = ctx.req.valid('form')

    const clientApp = await db.apps.findOne({ _id: client_id })
    if (!clientApp) {
      return ctx.redirect(getAuthorizeUrl(base, { type: 'oidc', error: 'invalid_client' }))
    }
    return ctx.redirect(
      getAuthorizeUrl(base, {
        clientAppId: client_id,
        type: 'oidc',
        params: JSON.stringify(rest),
        securityLevel: '' + (clientApp.openid?.minSecurityLevel ?? '0')
      })
    )
  })
  // OIDC Access Token Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#TokenEndpoint
  .post('/token', arktypeValidator('form', tOpenIdAccessTokenRequest), async (ctx) => {
    const request = ctx.req.valid('form')
    const { app } = ctx.var
    const { apps, tokens, sessions } = app.db
    const { clientId, clientSecret } = loadClientPassword(
      ctx,
      request.client_id,
      request.client_secret
    )
    const clientApp = await apps.findOne({ _id: clientId })
    if (!clientApp) {
      return ctx.json({ error: 'invalid_client' }, 400)
    }

    if (request.grant_type === 'authorization_code') {
      const tokenDoc = await tokens.findOneAndUpdate(
        {
          code: request.code,
          clientAppId: clientId,
          terminated: { $ne: true }
        },
        { $unset: { code: '', challenge: '' } },
        { returnDocument: 'before' }
      )
      if (!tokenDoc) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      checkClientSecret(ctx, clientApp, clientSecret)
      clientSecret || checkClientPKCE(ctx, tokenDoc.challenge, request.code_verifier)

      if (request.redirect_uri && !clientApp.callbackUrls.includes(request.redirect_uri)) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      const session = await sessions.findOne({ _id: tokenDoc.sessionId, terminated: { $ne: true } })
      if (!session) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      const { token, refreshToken } = await app.token.signToken(tokenDoc)
      ctx.set('token', JSON.parse(atob(token.split('.')[1])))

      let id_token: string | undefined

      const matchedPermissions = tokenDoc.permissions
        .map((p) => Permission.fromScopedString(p, UAAA))
        .filter((p) => p.test('/session/claim'))
      if (matchedPermissions.length) {
        id_token = await generateIDToken(ctx, clientId, tokenDoc.userId, tokenDoc.nonce)
      }
      return ctx.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: Math.floor((tokenDoc.expiresAt - Date.now()) / 1000),
        id_token,
        refresh_token: refreshToken
      })
    } else {
      const { refresh_token, client_id } = request
      checkClientSecret(ctx, clientApp, clientSecret)

      const { token, refreshToken } = await ctx.var.app.token.refreshToken(refresh_token, client_id)
      return ctx.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: JSON.parse(atob(token.split('.')[1])).exp - Math.floor(Date.now() / 1000),
        refresh_token: refreshToken
      })
    }
  })
  // OIDC UserInfo Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#UserInfo
  .on(
    ['GET', 'POST'],
    '/userinfo',
    verifyAuthorizationJwt,
    verifyPermission({ path: '/session/claim' }),
    async (ctx) => {
      const { app, token } = ctx.var
      if (!token.client_id) {
        ctx.status(401)
        ctx.header('WWW-Authenticate', 'error="invalid_token", error_description="Bad Token"')
        return ctx.body('')
      }
      const claims = await generateClaims(ctx, token.client_id, token.sub)
      return ctx.json(claims)
    }
  )
