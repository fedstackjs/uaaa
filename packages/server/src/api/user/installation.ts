import { arktypeValidator } from '@hono/arktype-validator'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { type } from 'arktype'
import { IInstallationDoc, IAppDoc } from '../../db/index.js'
import { BusinessError } from '../../util/errors.js'
import { idParamValidator } from '../_common.js'
import { verifyPermission } from '../_middleware.js'

export const userInstallationApi = new Hono()
  .get('/', verifyPermission({ path: '/user/installation' }), async (ctx) => {
    const { app, token } = ctx.var
    const installations = await app.db.installations
      .aggregate<
        Pick<IInstallationDoc, 'appId' | 'createdAt' | 'updatedAt' | 'disabled'> & {
          app: Pick<IAppDoc, 'name' | 'description' | 'icon'>
        }
      >([
        { $match: { userId: token.sub } },
        { $lookup: { from: 'apps', localField: 'appId', foreignField: '_id', as: 'app' } },
        { $unwind: '$app' },
        {
          $project: {
            appId: 1,
            'app.name': 1,
            'app.description': 1,
            'app.icon': 1,
            'app.disabled': 1,
            createdAt: 1,
            updatedAt: 1,
            disabled: 1
          }
        }
      ])
      .toArray()
    return ctx.json({ installations })
  })
  .put(
    '/',
    verifyPermission({ path: '/user/installation/edit' }),
    arktypeValidator(
      'json',
      type({
        appId: 'string',
        grantedPermissions: 'string[]',
        grantedClaims: 'string[]'
      })
    ),
    async (ctx) => {
      const { app, token } = ctx.var
      const { appId, grantedPermissions, grantedClaims } = ctx.req.valid('json')
      const clientApp = await app.db.apps.findOne({ _id: appId, disabled: { $ne: true } })
      const user = await app.db.users.findOne({ _id: token.sub })
      if (!clientApp || !user) throw new BusinessError('NOT_FOUND', { msg: 'App not found' })
      if (clientApp.disabled) {
        throw new BusinessError('BAD_REQUEST', { msg: `App ${appId} is disabled` })
      }

      const permissionSet = new Set(grantedPermissions)
      const missingPermissions = clientApp.requestedPermissions
        .filter((p) => p.required && !permissionSet.has(p.perm))
        .map((p) => p.perm)
      if (missingPermissions.length) {
        throw new BusinessError('MISSING_REQUIRED_PERMISSIONS', { perms: missingPermissions })
      }

      const claims = await app.claim.filterClaimsForApp(
        ctx,
        grantedClaims,
        clientApp.requestedClaims,
        user.claims
      )

      const now = Date.now()
      await app.db.installations.updateOne(
        { appId, userId: token.sub },
        {
          $set: { grantedPermissions, grantedClaims, updatedAt: now },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      )
      return ctx.json({
        grantedPermissions,
        grantedClaims: await app.claim.filterClaimsForUser(ctx, claims)
      })
    }
  )
  .get('/:id', verifyPermission({ path: '/user/installation' }), idParamValidator, async (ctx) => {
    const { id } = ctx.req.valid('param')
    const { app, token } = ctx.var
    const installation = await app.db.installations.findOne({ appId: id, userId: token.sub })
    if (!installation) throw new HTTPException(404)
    return ctx.json({ installation })
  })
  .put(
    '/:id/enable',
    verifyPermission({ path: '/user/installation/edit' }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      if (!(await app.db.apps.findOne({ _id: id, disabled: { $ne: true } }))) {
        throw new BusinessError('INVALID_OPERATION', {})
      }
      await app.db.installations.updateOne(
        { appId: id, userId: token.sub },
        { $unset: { disabled: '' } }
      )
      return ctx.json({})
    }
  )
  .put(
    '/:id/disable',
    verifyPermission({ path: '/user/installation/edit' }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      await app.db.tokens.updateMany(
        { appId: id, userId: token.sub },
        { $set: { terminated: true } }
      )
      await app.db.installations.updateOne(
        { appId: id, userId: token.sub },
        { $set: { disabled: true } }
      )
      return ctx.json({})
    }
  )
  .delete(
    '/:id',
    verifyPermission({ path: '/user/installation/edit' }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      await app.db.installations.deleteOne({ appId: id, userId: token.sub, disabled: true })
      return ctx.json({})
    }
  )
