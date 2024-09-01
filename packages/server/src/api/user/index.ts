import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { idParamValidator } from '../_common.js'
import { IAppDoc, IInstallationDoc } from '../../db/index.js'
import { BusinessError } from '../../util/errors.js'

export const userApi = new Hono()
  .use(verifyAuthorizationJwt)
  .use(verifyPermission({ securityLevel: 1 }))

  // Summary API
  .get('/', verifyPermission({ path: '/user' }), async (ctx) => {
    return ctx.json({})
  })

  // Claim API
  .get('/claim', verifyPermission({ path: '/user/claim' }), async (ctx) => {
    const { app, token } = ctx.var
    const user = await app.db.users.findOne({ _id: token.sub })
    if (!user) throw new HTTPException(404)
    return ctx.json({ claims: await app.claim.filterClaimsForUser(ctx, user.claims) })
  })
  .patch(
    '/claim/:name',
    verifyPermission({ path: '/user/claim/edit' }),
    arktypeValidator('param', type({ name: 'string' })),
    arktypeValidator('json', type({ value: 'string' })),
    async (ctx) => {
      const { app, token } = ctx.var
      const { name } = ctx.req.valid('param')
      const { value } = ctx.req.valid('json')
      if (!app.claim.hasClaim(name)) {
        throw new HTTPException(400, {
          message: `Claim ${name} does not exist`
        })
      }
      if (!app.claim.getClaimDescriptor(name).editable) {
        throw new HTTPException(403, {
          message: `Claim ${name} is not editable`
        })
      }
      await app.claim.verifyClaim(ctx, name, value)
      await app.db.users.updateOne(
        { _id: token.sub, [`claims.${name}.verified`]: { $ne: true } },
        { $set: { [`claims.${name}.value`]: value } }
      )
      return ctx.json({})
    }
  )

  // Session API
  .get('/session', verifyPermission({ path: '/user/session' }), async (ctx) => {
    //
  })
  .get('/session/:id', verifyPermission({ path: '/user/session' }), async (ctx) => {
    //
  })
  .post('/session/:id/terminate', verifyPermission({ path: '/user/session/edit' }), async (ctx) => {
    //
  })

  // Installation API
  .get('/installation', verifyPermission({ path: '/user/installation' }), async (ctx) => {
    const { app, token } = ctx.var
    const installations = await app.db.installations
      .aggregate<
        Pick<IInstallationDoc, 'appId' | 'createdAt' | 'updatedAt' | 'disabled'> & {
          app: Pick<IAppDoc, 'name' | 'description'>
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
    '/installation',
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
      if (!clientApp || !user) throw new HTTPException(404)
      if (clientApp.disabled) throw new HTTPException(400, { message: `App ${appId} is disabled` })

      const permissionSet = new Set(grantedPermissions)
      if (clientApp.requestedPermissions.some((p) => p.required && !permissionSet.has(p.perm))) {
        throw new HTTPException(400, { message: `Missing required permissions` })
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
  .get(
    '/installation/:id',
    verifyPermission({ path: '/user/installation' }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      const installation = await app.db.installations.findOne({ appId: id, userId: token.sub })
      if (!installation) throw new HTTPException(404)
      return ctx.json({ installation })
    }
  )
  .put(
    '/installation/:id/enable',
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
    '/installation/:id/disable',
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
    '/installation/:id',
    verifyPermission({ path: '/user/installation/edit' }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      await app.db.installations.deleteOne({ appId: id, userId: token.sub, disabled: true })
      return ctx.json({})
    }
  )

  // Credential API
  .get('/credential', verifyPermission({ path: '/user/credential' }), async (ctx) => {
    const credentials = await ctx.var.app.db.credentials
      .find({ userId: ctx.var.token.sub }, { projection: { secret: 0 } })
      .toArray()
    return ctx.json({ credentials })
  })
  .delete(
    '/credential',
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
  .get('/credential/bind', verifyPermission({ path: '/user/credential/edit' }), async (ctx) => {
    const { credential } = ctx.var.app
    const types = await credential.getBindTypes(ctx, ctx.var.token.sub)
    return ctx.json({ types })
  })
  .put(
    '/credential/bind',
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
  .get(
    '/credential/:id',
    verifyPermission({ path: '/user/credential' }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const credential = await ctx.var.app.db.credentials.findOne(
        { _id: id, userId: ctx.var.token.sub },
        { projection: { secret: 0 } }
      )
      if (!credential) throw new HTTPException(404)
      return ctx.json({ credential })
    }
  )
  .patch(
    '/credential/:id',
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

export type IUserApi = typeof userApi
