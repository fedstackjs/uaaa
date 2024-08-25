import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { Hono } from 'hono'

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
    refresh_token: 'string',
    'scope?': 'string|undefined'
  }
)

function mapScopeToPermission(scope: string): string[] {
  switch (scope) {
    case 'openid':
      return ['uaaa/user/claims/read']
    default:
      return [scope]
  }
}

function oauthScopeToPermissions(scope: string): string[] {
  return scope
    .split(' ')
    .map((item) => mapScopeToPermission(decodeURIComponent(item)))
    .flat()
}

export const oauthRouter = new Hono()
  // OIDC Discovery
  // https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig
  .get('/.well-known/openid-configuration', async (ctx) => {
    return ctx.json({
      issuer: new URL('/', ctx.req.url).toString(),
      authorization_endpoint: new URL('/authorize', ctx.req.url).toString(),
      jwks_uri: new URL('/api/public/jwks', ctx.req.url).toString(),
      response_types_supported: ['code', 'id_token', 'id_token token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256']
    })
  })
  // OIDC Authorization Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#AuthorizationEndpoint
  .on(
    ['GET', 'POST'],
    '/oauth/authorize',
    arktypeValidator('query', tOIDCAuthorizationRequest),
    arktypeValidator('form', tOIDCAuthorizationRequest),
    async (ctx) => {
      const { client_id, scope, ...rest } = ctx.req.valid(
        ctx.req.method === 'GET' ? 'query' : 'form'
      )
      const params = new URLSearchParams({
        clientAppId: client_id,
        permissions: JSON.stringify(oauthScopeToPermissions(scope)),
        type: 'oidc',
        params: JSON.stringify(rest)
      })
      return ctx.redirect(new URL('/authorize?' + params.toString(), ctx.req.url).toString())
    }
  )
  // OIDC Access Token Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#TokenEndpoint
  .post('/oauth/token', arktypeValidator('form', tOIDCAccessTokenRequest), async (ctx) => {
    const request = ctx.req.valid('form')
    const { apps, sessionOperations, sessions } = ctx.var.app.db
    if (request.grant_type === 'authorization_code') {
      const clientApp = await apps.findOne({ _id: request.client_id })
      if (!clientApp || clientApp.secret !== request.client_secret) {
        return ctx.json({ error: 'invalid_client' }, 400)
      }
      if (request.redirect_uri && !clientApp.callbackUrls.includes(request.redirect_uri)) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      const operation = await sessionOperations.findOne({
        _id: request.code,
        clientAppId: request.client_id
      })
      if (!operation) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      const session = await sessions.findOne({ _id: operation.sessionId })
      if (!session || session.terminated) {
        return ctx.json({ error: 'invalid_grant' }, 400)
      }

      const accessToken = await ctx.var.app.token.signPersisted(session.userId, operation)
      return ctx.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: Math.floor((operation.expiresAt - Date.now()) / 1000),
        // TODO: implement ID token
        // id_token: '',
        refresh_token: operation.refreshToken
      })
    } else {
      return ctx.json({ error: 'unsupported_grant_type' }, 400)
    }
  })
