import { arktypeValidator } from '@hono/arktype-validator'
import { Hono } from 'hono'
import { type } from 'arktype'
import { idParamValidator } from '../_common.js'
import { verifyPermission } from '../_middleware.js'
import { BusinessError } from '../../util/errors.js'

export const userCredentialApi = new Hono()
  .get('/', verifyPermission({ path: '/user/credential' }), async (ctx) => {
    const credentials = await ctx.var.app.db.credentials
      .find({ userId: ctx.var.token.sub }, { projection: { secret: 0 } })
      .toArray()
    return ctx.json({ credentials })
  })
  .delete(
    '/',
    verifyPermission({ path: '/user/credential/edit' }),
    arktypeValidator(
      'json',
      type({
        type: 'string',
        payload: 'unknown',
        credentialId: 'string'
      })
    ),
    async (ctx) => {
      const { type, payload, credentialId } = ctx.req.valid('json')
      const { credential } = ctx.var.app
      return ctx.json(
        await credential.handleUnbind(ctx, type, ctx.var.token.sub, credentialId, payload)
      )
    }
  )
  .get('/bind', verifyPermission({ path: '/user/credential/edit' }), async (ctx) => {
    const { credential } = ctx.var.app
    const types = await credential.getBindTypes(ctx, ctx.var.token.sub)
    return ctx.json({ types })
  })
  .put(
    '/bind',
    verifyPermission({ path: '/user/credential/edit' }),
    arktypeValidator(
      'json',
      type({
        type: 'string',
        payload: 'unknown',
        'credentialId?': 'string'
      })
    ),
    async (ctx) => {
      const { type, payload, credentialId } = ctx.req.valid('json')
      const { credential } = ctx.var.app
      return ctx.json(
        await credential.handleBind(ctx, type, ctx.var.token.sub, credentialId, payload)
      )
    }
  )
  .get('/:id', verifyPermission({ path: '/user/credential' }), idParamValidator, async (ctx) => {
    const { id } = ctx.req.valid('param')
    const credential = await ctx.var.app.db.credentials.findOne(
      { _id: id, userId: ctx.var.token.sub },
      { projection: { secret: 0 } }
    )
    if (!credential) throw new BusinessError('NOT_FOUND', { msg: 'Credential not found' })
    return ctx.json({ credential })
  })
  .patch(
    '/:id',
    verifyPermission({ path: '/user/credential' }),
    idParamValidator,
    arktypeValidator(
      'json',
      type({
        remark: 'string'
      })
    ),
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { remark } = ctx.req.valid('json')
      await ctx.var.app.db.credentials.updateOne(
        { _id: id, userId: ctx.var.token.sub },
        { $set: { remark } }
      )
      return ctx.json({})
    }
  )
