import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { nanoid } from 'nanoid'
import ms from 'ms'
import { HTTPException } from 'hono/http-exception'
import { idParamValidator } from '../_common.js'

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
  // Supported login methods
  .get('/login', (ctx) => {
    return ctx.json({ types: ctx.var.app.credential.getLoginTypes() })
  })
  // Get Application info
  .get('/app/:id', idParamValidator, async (ctx) => {
    const { id } = ctx.req.valid('param')
    const app = await ctx.var.app.db.apps.findOne(
      { _id: id },
      { projection: { callbackUrls: 0, secret: 0 } }
    )
    if (!app) throw new HTTPException(404)
    return ctx.json(app)
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
      const { credential, db, token, config } = ctx.var.app
      const { userId, securityLevel, expiresIn } = await credential.handleLogin(ctx, type, payload)
      const { insertedId: sessionId } = await db.sessions.insertOne({
        _id: nanoid(),
        userId,
        tokenCount: securityLevel > 0 ? 2 : 1,
        authorizedApps: []
      })
      const tokens: Array<{
        token: string
        refreshToken?: string | undefined
      }> = []
      const timestamp = Date.now()
      tokens.push(
        await token.createAndSignToken({
          sessionId,
          userId,
          index: 0,
          permissions: ['uaaa/**/*'],
          securityLevel: 0,
          createdAt: timestamp,
          expiresAt: timestamp + ms(config.get('sessionTimeout')),
          tokenTimeout: ms(config.get('tokenTimeout')),
          refreshTimeout: ms(config.get('refreshTimeout'))
        })
      )
      if (securityLevel > 0) {
        tokens.push(
          await token.createAndSignToken({
            sessionId,
            userId,
            index: 1,
            permissions: ['uaaa/**/*'],
            securityLevel,
            createdAt: timestamp,
            expiresAt: timestamp + expiresIn,
            tokenTimeout: ms(config.get('tokenTimeout')),
            refreshTimeout: ms(config.get('refreshTimeout'))
          })
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
        'clientId?': 'string|undefined',
        'clientSecret?': 'string|undefined'
      })
    ),
    async (ctx) => {
      const { refreshToken, clientId, clientSecret } = ctx.req.valid('json')
      const { app } = ctx.var
      if (clientId) {
        const client = await app.db.apps.findOne({ _id: clientId }, { projection: { secret: 1 } })
        if (!client || client.secret !== clientSecret) {
          throw new HTTPException(401)
        }
      }
      return ctx.json(await app.token.refreshToken(refreshToken, clientId))
    }
  )

export type IPublicApi = typeof publicApi
