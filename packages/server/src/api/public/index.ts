import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { nanoid } from 'nanoid'
import { idParamValidator } from '../_common.js'
import type { IAppDoc } from '../../db/index.js'
import { BusinessError } from '../../util/errors.js'
import { getRemoteIP, getUserAgent } from '../_helper.js'
import { UAAA } from '../../util/constants.js'
import { UAAAProvidedPermissions } from '../../util/permission.js'
import type { ITokenDoc } from '../../db/model/token.js'

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
        .find({ promoted: true }, { projection: { secret: 0, secrets: 0, callbackUrls: 0 } })
        .toArray()
    return ctx.json({ apps })
  })
  // Get Application info
  .get('/app/:id', idParamValidator, async (ctx) => {
    const { id } = ctx.req.valid('param')
    const app: null | Omit<IAppDoc, 'secret' | 'secrets' | 'callbackUrls'> =
      await ctx.var.app.db.apps.findOne(
        { _id: id },
        { projection: { secret: 0, secrets: 0, callbackUrls: 0 } }
      )
    if (!app) {
      throw new BusinessError('NOT_FOUND', { msg: 'App not found' })
    }
    return ctx.json({ app })
  })
  // Get application provided permissions
  .get('/app/:id/provided_permissions', idParamValidator, async (ctx) => {
    const { id } = ctx.req.valid('param')
    if (id === UAAA) return ctx.json({ permissions: UAAAProvidedPermissions })

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
    arktypeValidator('json', type({ url: 'string' })),
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { url } = ctx.req.valid('json')
      const app = await ctx.var.app.db.apps.findOne(
        { _id: id },
        { projection: { callbackUrls: 1 } }
      )
      if (!app) {
        throw new BusinessError('NOT_FOUND', { msg: 'App not found' })
      }
      if (!app.callbackUrls.includes(url)) {
        throw new BusinessError('BAD_REQUEST', { msg: 'Invalid redirect url' })
      }
      return ctx.json({})
    }
  )
  // Supported login methods
  .get('/login', (ctx) => {
    return ctx.json({ types: ctx.var.app.credential.getLoginTypes() })
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
      const { credential, db, token } = ctx.var.app
      const { userId, securityLevel, expiresIn, credentialId, tokenTimeout, refreshTimeout } =
        await credential.handleLogin(ctx, type, payload)
      const now = Date.now()
      const { insertedId: sessionId } = await db.sessions.insertOne({
        _id: nanoid(),
        userId,
        tokenCount: securityLevel > 0 ? 2 : 1,
        expiresAt: now,
        createdAt: now,
        authorizedApps: [],
        environment: {
          ip: getRemoteIP(ctx),
          ua: getUserAgent(ctx)
        }
      })
      const tokens: Array<{
        token: string
        refreshToken?: string | undefined
      }> = []
      const partialTokenDoc = {
        sessionId,
        userId,
        permissions: [`${UAAA}/**`],
        credentialId
      } satisfies Partial<ITokenDoc>
      tokens.push(
        await token.createAndSignToken(
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
      )
      if (securityLevel > 0) {
        tokens.push(
          await token.createAndSignToken(
            {
              ...partialTokenDoc,
              index: 1,
              parentId: JSON.parse(atob(tokens[0].token.split('.')[1])).jti,
              securityLevel,
              createdAt: now,
              expiresAt: now + token.getSessionTokenTimeout(securityLevel, expiresIn),
              tokenTimeout: token.getTokenTimeout(securityLevel, tokenTimeout),
              refreshTimeout: token.getRefreshTimeout(securityLevel, refreshTimeout)
            },
            { generateCode: false }
          )
        )
      }
      return ctx.json({ tokens })
    }
  )
  // Refresh Token
  .post(
    '/refresh',
    arktypeValidator(
      'json',
      type({
        refreshToken: 'string',
        'clientId?': 'string',
        'clientSecret?': 'string'
      })
    ),
    async (ctx) => {
      const { app } = ctx.var
      const { refreshToken, clientId, clientSecret } = ctx.req.valid('json')
      return ctx.json(
        await app.token.refreshToken(refreshToken, {
          id: clientId,
          secret: clientSecret
        })
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
      type({
        userCode: 'string',
        authCode: 'string',
        request: 'Record<string, unknown>'
      })
    ),
    async (ctx) => {
      const { userCode, authCode, request } = ctx.req.valid('json')
      const response = await ctx.var.app.session.remoteAppPoll(userCode, authCode, request)
      return ctx.json(response)
    }
  )

export type IPublicApi = typeof publicApi
