import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { nanoid } from 'nanoid'
import ms from 'ms'

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
  // Login
  .post(
    '/login',
    arktypeValidator(
      'json',
      type({
        type: 'string',
        payload: 'any'
      })
    ),
    async (ctx) => {
      const { type, payload } = ctx.req.valid('json')
      const { credential, db, token, config } = ctx.var.app
      const { userId, securityLevel, expiresIn } = await credential.handleLogin(ctx, type, payload)
      const { insertedId: sessionId } = await db.sessions.insertOne({
        _id: nanoid(),
        userId,
        tokenCount: securityLevel > 0 ? 2 : 1
      })
      const tokens: string[] = []
      const timestamp = Date.now()
      const { token: loginToken } = await token.createAndSignToken({
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
      tokens.push(loginToken)
      if (securityLevel > 0) {
        const { token: elevatedToken } = await token.createAndSignToken({
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
        tokens.push(elevatedToken)
      }
      return ctx.json({ tokens })
    }
  )
  .post(
    '/refresh',
    arktypeValidator(
      'json',
      type({
        refreshToken: 'string'
      })
    ),
    async (ctx) => {
      const { refreshToken } = ctx.req.valid('json')
      const { app } = ctx.var
      return ctx.json(app.token.refreshToken(refreshToken))
    }
  )

export type IPublicApi = typeof publicApi
