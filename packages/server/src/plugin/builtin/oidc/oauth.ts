import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { Context, Hono } from 'hono'
import ms from 'ms'
import { BusinessError, checkPermission } from '../../../util/index.js'
import { verifyAuthorizationJwt, verifyPermission } from '../../../api/index.js'
import type { IUserClaims, ClaimName } from '../../../index.js'

const tOIDCAuthorizationRequest = type({
  scope: 'string',
  response_type: "'code' | 'id_token' | 'id_token token'",
  client_id: 'string',
  redirect_uri: 'string',
  'state?': 'string'
})

const tOIDCAccessTokenRequest = type(
  {
    grant_type: "'authorization_code'",
    client_id: 'string',
    client_secret: 'string',
    code: 'string',
    'redirect_uri?': 'string|undefined'
  },
  '|',
  {
    grant_type: "'refresh_token'",
    client_id: 'string',
    client_secret: 'string',
    refresh_token: 'string',
    'scope?': 'string|undefined'
  }
)

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
  if (!installation || !clientApp || !user) throw new BusinessError('NOT_FOUND', {})
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
    const alias = descriptor.oidcAlias ?? key
    mappedClaims[alias] = value?.value
    if (value?.verified && descriptor.oidcVerifiable) mappedClaims[`${alias}_verified`] = true
  }

  const additionalClaims = ctx.var.app.config.get('oidcAdditionalClaims') ?? {}
  for (const [key, value] of Object.entries(additionalClaims)) {
    mappedClaims[key] = generateAdditionalClaim(claims, value)
  }
  return mappedClaims
}

async function generateIDToken(ctx: Context, appId: string, userId: string) {
  const { app } = ctx.var
  const mappedClaims = await generateClaims(ctx, appId, userId)
  const now = Date.now()
  return app.token.sign({
    ...mappedClaims,
    aud: appId,
    exp: now + ms(app.config.get('tokenTimeout')),
    iat: now
  })
}

export const oauthRouter = new Hono()
  // OIDC Discovery
  // https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig
  .get('/.well-known/openid-configuration', async (ctx) => {
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
  // OIDC Authorization Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#AuthorizationEndpoint
  .get('/oauth/authorize', arktypeValidator('query', tOIDCAuthorizationRequest), async (ctx) => {
    const { client_id, ...rest } = ctx.req.valid('query')
    const params = new URLSearchParams({
      clientAppId: client_id,
      type: 'oidc',
      params: JSON.stringify(rest),
      securityLevel: '0'
    })
    return ctx.redirect(new URL('/authorize?' + params.toString(), ctx.req.url).toString())
  })
  .post('/oauth/authorize', arktypeValidator('form', tOIDCAuthorizationRequest), async (ctx) => {
    const { client_id, ...rest } = ctx.req.valid('form')
    const params = new URLSearchParams({
      clientAppId: client_id,
      type: 'oidc',
      params: JSON.stringify(rest),
      securityLevel: '0'
    })
    return ctx.redirect(new URL('/authorize?' + params.toString(), ctx.req.url).toString())
  })
  // OIDC Access Token Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#TokenEndpoint
  .post('/oauth/token', arktypeValidator('form', tOIDCAccessTokenRequest), async (ctx) => {
    const request = ctx.req.valid('form')
    const { app } = ctx.var
    const { apps, tokens, sessions } = app.db
    if (request.grant_type === 'authorization_code') {
      const clientApp = await apps.findOne({ _id: request.client_id })
      if (!clientApp || clientApp.secret !== request.client_secret) {
        return ctx.json({ error: 'invalid_client' }, 400)
      }
      if (request.redirect_uri && !clientApp.callbackUrls.includes(request.redirect_uri)) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      const tokenDoc = await tokens.findOne({
        _id: request.code,
        clientAppId: request.client_id,
        lastIssuedAt: { $exists: false },
        terminated: { $ne: true }
      })
      if (!tokenDoc) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      const session = await sessions.findOne({ _id: tokenDoc.sessionId, terminated: { $ne: true } })
      if (!session) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      const { token, refreshToken } = await app.token.signToken(tokenDoc)
      ctx.set('token', JSON.parse(atob(token.split('.')[1])))

      let id_token: string | undefined
      const matchedPermissions = checkPermission(tokenDoc.permissions, '/session/claim')
      if (matchedPermissions.length) {
        id_token = await generateIDToken(ctx, request.client_id, tokenDoc.userId)
      }
      return ctx.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: Math.floor((tokenDoc.expiresAt - Date.now()) / 1000),
        id_token,
        refresh_token: refreshToken
      })
    } else {
      const { refresh_token, client_id, client_secret } = request
      const client = await app.db.apps.findOne({ _id: client_id }, { projection: { secret: 1 } })
      if (!client || client.secret !== client_secret) {
        return ctx.json({ error: 'invalid_client' }, 400)
      }
      const { token, refreshToken } = await ctx.var.app.token.refreshToken(refresh_token, client_id)
      return ctx.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: Math.floor(ms(app.config.get('tokenTimeout')) / 1000),
        refresh_token: refreshToken
      })
    }
  })
  // OIDC UserInfo Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#UserInfo
  .on(
    ['GET', 'POST'],
    '/oauth/userinfo',
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
