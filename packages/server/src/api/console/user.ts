import { Hono } from 'hono'
import { type } from 'arktype'
import { idParamValidator, pageQueryValidator } from '../_common.js'
import { arktypeValidator, verifyPermission } from '../_middleware.js'
import { BusinessError } from '../../util/errors.js'

export const consoleUserApi = new Hono()
  .use(verifyPermission({ path: '/console/user' }))
  .get('/', pageQueryValidator, async (ctx) => {
    const { app } = ctx.var
    const { skip, limit, count } = ctx.req.valid('query')
    const users = await app.db.users.find({}, { skip, limit, projection: { salt: 0 } }).toArray()
    return ctx.json({ users, count: count ? await app.db.users.countDocuments() : 0 })
  })
  .patch(
    '/:id/claim/:name',
    arktypeValidator('param', type({ id: 'string', name: 'string' })),
    arktypeValidator('json', type({ value: 'string' })),
    async (ctx) => {
      const { app } = ctx.var
      const { id, name } = ctx.req.valid('param')
      const { value } = ctx.req.valid('json')
      if (!app.claim.hasClaim(name)) {
        throw new BusinessError('BAD_REQUEST', { msg: `Claim ${name} does not exist` })
      }
      const descriptor = app.claim.getClaimDescriptor(name)
      if (false === (descriptor.editable ?? false)) {
        throw new BusinessError('FORBIDDEN', { msg: `Claim ${name} is not editable` })
      }
      await app.claim.verifyClaim(ctx, name, value)
      await app.db.users.updateOne(
        { _id: id, [`claims.${name}.verified`]: { $ne: true } },
        { $set: { [`claims.${name}.value`]: value } }
      )
      return ctx.json({})
    }
  )
  .put('/:id/enable', idParamValidator, async (ctx) => {
    const { app } = ctx.var
    const { id } = ctx.req.valid('param')
    await app.db.users.updateOne({ _id: id }, { $unset: { disabled: '' } })
    return ctx.json({})
  })
  .put('/:id/disable', idParamValidator, async (ctx) => {
    const { app } = ctx.var
    const { id } = ctx.req.valid('param')
    await app.db.users.updateOne({ _id: id }, { $set: { disabled: true } })
    await app.db.sessions.updateMany({ userId: id }, { $set: { terminated: true } })
    await app.db.tokens.updateMany({ userId: id }, { $set: { terminated: true } })
    return ctx.json({})
  })
