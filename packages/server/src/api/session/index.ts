import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import ms from 'ms'
import { UAAA } from '../../util/index.js'

export const sessionApi = new Hono()
  .use(verifyAuthorizationJwt)
  .get('/', verifyPermission({ path: 'uaaa/session/info' }), async (ctx) => {
    //
  })
  .get(
    '/elevate',
    verifyPermission({ path: 'uaaa/session/elevate' }),
    arktypeValidator(
      'query',
      type({
        targetLevel: 'number'
      })
    ),
    async (ctx) => {
      const { targetLevel } = ctx.req.valid('query')
      const types = await ctx.var.app.credential.getVerifyTypes(ctx, ctx.var.token.sub, targetLevel)
      return ctx.json({ types })
    }
  )
  .post(
    '/elevate',
    verifyPermission({ path: 'uaaa/session/elevate' }),
    arktypeValidator(
      'json',
      type({
        type: 'string',
        targetLevel: 'number',
        payload: 'any'
      })
    ),
    async (ctx) => {
      const { type, payload, targetLevel } = ctx.req.valid('json')
      const { credential, db, token } = ctx.var.app
      const { securityLevel, expiresIn } = await credential.handleVerify(
        ctx,
        type,
        ctx.var.token.sub,
        targetLevel,
        payload
      )
      const session = await db.sessions.findOneAndUpdate(
        { _id: ctx.var.token.sid },
        { $inc: { operationCount: 1 } },
        { returnDocument: 'before' }
      )
      if (!session) throw new HTTPException(401)
      return ctx.json({
        token: await token.persistAndSign(session.operationCount, {
          sessionId: ctx.var.token.sid,
          userId: ctx.var.token.sub,
          permissions: ['uaaa/session/**/*'],
          securityLevel,
          createdAt: Date.now(),
          expiresAt: Date.now() + expiresIn
        })
      })
    }
  )
  .post(
    '/derive',
    verifyPermission({ path: 'uaaa/session/derive' }),
    arktypeValidator(
      'json',
      type({
        'targetAppId?': 'string',
        clientAppId: 'string',
        securityLevel: 'number'
      })
    ),
    async (ctx) => {
      const { targetAppId, clientAppId, securityLevel } = ctx.req.valid('json')
      const { app, token } = ctx.var
      if (token.client_id && !targetAppId) {
        throw new HTTPException(403, {
          message: 'Secondary token can only derive application token'
        })
      }
      if (securityLevel > token.level) throw new HTTPException(403)

      const clientApp = await app.db.apps.findOne({ _id: clientAppId })
      if (!clientApp) throw new HTTPException(404)
      if (securityLevel > clientApp.securityLevel) throw new HTTPException(403)

      const installation = await app.db.installations.findOne({
        userId: token.sub,
        appId: clientAppId
      })
      if (!installation) throw new HTTPException(403)

      const permHost = targetAppId ?? UAAA
      const permissions = installation.grantedPermissions.filter(
        (perm) => new URL(`uperm://${perm}`).host === permHost
      )
      if (!permissions.length) throw new HTTPException(403)

      const session = await app.db.sessions.findOneAndUpdate(
        { _id: token.sid },
        { $inc: { operationCount: 1 } },
        { returnDocument: 'before' }
      )
      if (!session) throw new HTTPException(401)
      const timestamp = Date.now()
      return ctx.json({
        token: await app.token.persistAndSign(session.operationCount, {
          sessionId: token.sid,
          userId: token.sub,
          targetAppId,
          clientAppId,
          permissions,
          securityLevel,
          createdAt: timestamp,
          expiresAt: timestamp + ms(app.config.get('sessionTimeout'))
        })
      })
    }
  )
  .post('/extends')
export type ISessionApi = typeof sessionApi
