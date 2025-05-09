import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { idParamValidator } from '../_common.js'
import type { IAppDoc } from '../../db/index.js'
import { BusinessError } from '../../util/errors.js'
import { getRemoteIP, getUserAgent } from '../_helper.js'
import { UAAAProvidedPermissions } from '../../util/permission.js'
import { tExchangeOptions, tRemoteRequest } from '../../session/index.js'

/** Public API */
export const publicApi = new Hono()
  // Health-check endpoint
  .get('/health', (ctx) => {
    return ctx.json({ status: 'ok' })
  })
  // JWKS endpoint
  .get('/jwks', async (ctx) => {
    return ctx.json(await ctx.var.app.token.getJWKS())
  })
  // List promoted applications
  .get('/app', async (ctx) => {
    const apps: Array<null | Omit<IAppDoc, 'secret' | 'secrets' | 'callbackUrls'>> =
      await ctx.var.app.db.apps
        .find(
          { 'config.promoted': true },
          { projection: { secret: 0, secrets: 0, callbackUrls: 0 } }
        )
        .toArray()
    return ctx.json({ apps })
  })
  // Get Application info
  .get('/app/:id', idParamValidator, async (ctx) => {
    const { id } = ctx.req.valid('param')
    const app: null | Omit<IAppDoc, 'secret' | 'secrets' | 'config' | 'openid' | 'callbackUrls'> =
      await ctx.var.app.db.apps.findOne(
        { _id: id },
        { projection: { secret: 0, secrets: 0, config: 0, openid: 0, callbackUrls: 0 } }
      )
    if (!app) {
      throw new BusinessError('NOT_FOUND', { msg: 'App not found' })
    }
    return ctx.json({ app })
  })
  // Get application provided permissions
  .get('/app/:id/provided_permissions', idParamValidator, async (ctx) => {
    const { id } = ctx.req.valid('param')
    if (id === ctx.var.app.appId) return ctx.json({ permissions: UAAAProvidedPermissions })

    const app = await ctx.var.app.db.apps.findOne(
      { _id: id },
      { projection: { providedPermissions: 1 } }
    )
    if (!app) {
      throw new BusinessError('NOT_FOUND', { msg: 'App not found' })
    }
    return ctx.json({ permissions: app.providedPermissions })
  })
  // Check redirect url
  .post(
    '/app/:id/check_redirect',
    idParamValidator,
    arktypeValidator('json', type({ url: 'string', 'type?': '"authorize"|"logout"' })),
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { url, type = 'authorize' } = ctx.req.valid('json')
      const app = await ctx.var.app.db.apps.findOne(
        { _id: id },
        { projection: { callbackUrls: 1, openid: 1 } }
      )
      if (!app) {
        throw new BusinessError('NOT_FOUND', { msg: 'App not found' })
      }
      switch (type) {
        case 'authorize':
          if (!app.callbackUrls.includes(url)) {
            throw new BusinessError('BAD_REQUEST', { msg: 'Invalid redirect url' })
          }
          break
        case 'logout':
          if (!app.openid?.logoutUrls?.includes(url)) {
            throw new BusinessError('BAD_REQUEST', { msg: 'Invalid redirect url' })
          }
          break
      }
      return ctx.json({})
    }
  )
  // Supported login methods
  .get('/login', async (ctx) => {
    return ctx.json({ types: await ctx.var.app.credential.getLoginTypes(ctx) })
  })
  // Login
  .post(
    '/login',
    arktypeValidator(
      'json',
      type({
        type: 'string',
        payload: 'unknown'
      })
    ),
    async (ctx) => {
      const { type, payload } = ctx.req.valid('json')
      const { credential, session } = ctx.var.app
      const loginResult = await credential.handleLogin(ctx, type, payload)
      const environment = {
        ip: getRemoteIP(ctx),
        ua: getUserAgent(ctx)
      }
      return ctx.json(await session.login(loginResult, environment))
    }
  )
  // Exchange
  .post(
    '/exchange',
    arktypeValidator(
      'json',
      type({
        from: 'string',
        config: tExchangeOptions
      })
    ),
    async (ctx) => {
      const { app } = ctx.var
      const { from, config } = ctx.req.valid('json')
      const { payload } = await app.token.verifyToken(from)
      const environment = {
        ip: getRemoteIP(ctx),
        ua: getUserAgent(ctx)
      }
      return ctx.json(await app.session.exchange(payload, config, environment))
    }
  )
  // Refresh Token
  .post(
    '/refresh',
    arktypeValidator(
      'json',
      type({
        refreshToken: 'string',
        clientAppId: 'string',
        'clientAppSecret?': 'string',
        'targetAppId?': 'string'
      })
    ),
    async (ctx) => {
      const { app } = ctx.var
      const { refreshToken, clientAppId, clientAppSecret, targetAppId } = ctx.req.valid('json')
      return ctx.json(
        await app.token.refreshToken(
          refreshToken,
          { id: clientAppId, secret: clientAppSecret },
          targetAppId
        )
      )
    }
  )
  // Request remote auth
  .post('/remote_authorize', async (ctx) => {
    return ctx.json(await ctx.var.app.session.generateRemoteCode())
  })
  // Remote auth poll
  .post(
    '/remote_authorize_poll',
    arktypeValidator(
      'json',
      type({ userCode: 'string', authCode: 'string', request: tRemoteRequest })
    ),
    async (ctx) => {
      const { userCode, authCode, request } = ctx.req.valid('json')
      const response = await ctx.var.app.session.remoteAppPoll(userCode, authCode, request)
      return ctx.json({ response })
    }
  )

export type IPublicApi = typeof publicApi
