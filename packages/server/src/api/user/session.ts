import { arktypeValidator } from '@hono/arktype-validator'
import { Hono } from 'hono'
import { type } from 'arktype'
import { BusinessError, SECURITY_LEVEL } from '../../util/index.js'
import { pageQueryValidator, idParamValidator } from '../_common.js'
import { verifyPermission } from '../_middleware.js'

export const userSessionApi = new Hono()
  .use(verifyPermission({ securityLevel: SECURITY_LEVEL.HIGH }))
  .get('/', verifyPermission({ path: '/user/session' }), pageQueryValidator, async (ctx) => {
    const { app, token } = ctx.var
    const { skip, limit, count } = ctx.req.valid('query')
    const sessions = await app.db.sessions
      .find({ userId: token.sub }, { skip, limit, sort: { expiresAt: -1 } })
      .toArray()
    return ctx.json({
      sessions,
      count: count ? await app.db.sessions.countDocuments({ userId: token.sub }) : 0
    })
  })
  .get('/:id', verifyPermission({ path: '/user/session' }), idParamValidator, async (ctx) => {
    const { id } = ctx.req.valid('param')
    const { app, token } = ctx.var
    const session = await app.db.sessions.findOne({ _id: id, userId: token.sub })
    if (!session) throw new BusinessError('NOT_FOUND', { msg: `Session ${id} not found` })
    return ctx.json({ session })
  })
  .get(
    '/:id/token',
    verifyPermission({ path: '/user/session/token' }),
    idParamValidator,
    pageQueryValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      const { skip, limit, count } = ctx.req.valid('query')
      const tokens = await app.db.tokens
        .find(
          { sessionId: id, userId: token.sub },
          { skip, limit, sort: { createdAt: -1 }, projection: { refreshToken: 0 } }
        )
        .toArray()
      return ctx.json({
        tokens,
        count: count ? await app.db.tokens.countDocuments({ sessionId: id, userId: token.sub }) : 0
      })
    }
  )
  .post(
    '/:id/token/:tokenId/terminate',
    verifyPermission({ path: '/user/session/edit' }),
    arktypeValidator(
      'param',
      type({
        id: 'string',
        tokenId: 'string'
      })
    ),
    async (ctx) => {
      const { id, tokenId } = ctx.req.valid('param')
      const { app, token } = ctx.var
      await app.db.tokens.updateOne(
        { _id: tokenId, sessionId: id, userId: token.sub },
        { $set: { terminated: true } }
      )
      return ctx.json({})
    }
  )
  .post(
    '/:id/terminate',
    verifyPermission({ path: '/user/session/edit' }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      const session = await app.db.sessions.findOne({ _id: id, userId: token.sub })
      if (!session) throw new BusinessError('NOT_FOUND', { msg: `Session ${id} not found` })
      await app.db.sessions.updateOne({ _id: id }, { $set: { terminated: true } })
      await app.db.tokens.updateMany({ sessionId: id }, { $set: { terminated: true } })
      return ctx.json({})
    }
  )
