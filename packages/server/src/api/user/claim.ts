import { arktypeValidator } from '@hono/arktype-validator'
import { Hono } from 'hono'
import { type } from 'arktype'
import { BusinessError } from '../../util/errors.js'
import { verifyPermission } from '../_middleware.js'

export const userClaimApi = new Hono()
  .get('/', verifyPermission({ path: '/user/claim' }), async (ctx) => {
    const { app, token } = ctx.var
    const user = await app.db.users.findOne({ _id: token.sub })
    if (!user) throw new BusinessError('NOT_FOUND', { msg: 'User not found' })
    const claims = await app.claim.filterClaimsForUser(ctx, user.claims)
    const descriptors = await app.claim.filterClaimDescriptors(ctx)
    return ctx.json({ claims, descriptors })
  })
  .patch(
    '/:name',
    verifyPermission({ path: '/user/claim/edit' }),
    arktypeValidator('param', type({ name: 'string' })),
    arktypeValidator('json', type({ value: 'string' })),
    async (ctx) => {
      const { app, token } = ctx.var
      const { name } = ctx.req.valid('param')
      const { value } = ctx.req.valid('json')
      if (!app.claim.hasClaim(name)) {
        throw new BusinessError('BAD_REQUEST', {
          msg: `Claim ${name} does not exist`
        })
      }

      const editable = app.claim.getClaimDescriptor(name).editable ?? false
      if (typeof editable === 'boolean') {
        if (!editable) {
          throw new BusinessError('FORBIDDEN', { msg: `Claim ${name} is not editable` })
        }
      } else {
        if (token.level < editable) {
          throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', { required: editable })
        }
      }

      await app.claim.verifyClaim(ctx, name, value)
      await app.db.users.updateOne(
        { _id: token.sub, [`claims.${name}.verified`]: { $ne: true } },
        { $set: { [`claims.${name}.value`]: value } }
      )
      return ctx.json({})
    }
  )
