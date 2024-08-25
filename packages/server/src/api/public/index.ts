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
  .get('/login-types', (ctx) => {
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
        operationCount: securityLevel > 0 ? 2 : 1
      })
      const tokens: string[] = []
      const timestamp = Date.now()
      tokens.push(
        await token.persistAndSign(0, {
          sessionId,
          userId,
          permissions: ['uaaa/session/**/*'],
          securityLevel: 0,
          createdAt: timestamp,
          expiresAt: timestamp + ms(config.get('sessionTimeout'))
        })
      )
      if (securityLevel > 0) {
        tokens.push(
          await token.persistAndSign(1, {
            sessionId,
            userId,
            permissions: ['uaaa/**/*'],
            securityLevel,
            createdAt: timestamp,
            expiresAt: timestamp + expiresIn
          })
        )
      }
      return ctx.json({ tokens })
    }
  )

export type IPublicApi = typeof publicApi
