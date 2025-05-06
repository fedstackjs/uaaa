import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { arktypeValidator } from '@hono/arktype-validator'
import { verifyAuthorizationJwt, verifyPermission } from '../api/_middleware.js'
import { type } from 'arktype'

export const oauthWellKnownRouter = new Hono()
  .use(cors())
  // OIDC Discovery
  // https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig
  .get('/openid-configuration', async (ctx) => {
    return ctx.json(await ctx.var.app.oauth.getMetadata())
  })

export const oauthRouter = new Hono()
  // OIDC Authorization Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#AuthorizationEndpoint
  .get('/authorize', async (ctx) => {
    const url = await ctx.var.app.oauth.authorizeToUI(ctx, ctx.req.query())
    return ctx.redirect(url)
  })
  .post('/authorize', arktypeValidator('form', type('Record<string,string>')), async (ctx) => {
    const url = await ctx.var.app.oauth.authorizeToUI(ctx, ctx.req.valid('form'))
    return ctx.redirect(url)
  })

  // OIDC End Session Endpoint
  // see https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout
  .get('/logout', async (ctx) => {
    const url = await ctx.var.app.oauth.endSessionToUI(ctx, ctx.req.query())
    return ctx.redirect(url)
  })
  .post('/logout', arktypeValidator('form', type('Record<string,string>')), async (ctx) => {
    const url = await ctx.var.app.oauth.endSessionToUI(ctx, ctx.req.valid('form'))
    return ctx.redirect(url)
  })

  // OIDC Access Token Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#TokenEndpoint
  .post('/token', cors(), arktypeValidator('form', type('Record<string,string>')), async (ctx) => {
    const response = await ctx.var.app.oauth.handleTokenRequest(ctx, ctx.req.valid('form'))
    return ctx.json(response)
  })

  // OIDC UserInfo Endpoint
  // see https://openid.net/specs/openid-connect-core-1_0-final.html#UserInfo
  .on(
    ['GET', 'POST'],
    '/userinfo',
    cors(),
    verifyAuthorizationJwt,
    verifyPermission({ path: '/session/claim' }),
    async (ctx) => {
      const response = await ctx.var.app.oauth.handleUserInfoRequest(ctx)
      return ctx.json(response)
    }
  )
  // Device Authorization Endpoint
  .post('/device/code', arktypeValidator('form', type('Record<string,string>')), async (ctx) => {
    const response = await ctx.var.app.oauth.handleDeviceCodeRequest(ctx, ctx.req.valid('form'))
    return ctx.json(response)
  })
