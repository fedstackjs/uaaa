import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { idParamValidator, pageQueryValidator } from '../_common.js'
import { IAppDoc, IInstallationDoc } from '../../db/index.js'
import { BusinessError } from '../../util/errors.js'
import { SecurityLevels } from '../../util/types.js'

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
    const claims = await app.claim.filterClaimsForUser(ctx, user.claims)
    const descriptors = await app.claim.filterClaimDescriptors(ctx)
    return ctx.json({ claims, descriptors })
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

  // Session API
  .get(
    '/session',
    verifyPermission({ path: '/user/session', securityLevel: SecurityLevels.SL2 }),
    pageQueryValidator,
    async (ctx) => {
      const { app, token } = ctx.var
      const { skip, limit, count } = ctx.req.valid('query')
      const sessions = await app.db.sessions.find({ userId: token.sub }, { skip, limit }).toArray()
      return ctx.json({
        sessions,
        count: count ? await app.db.sessions.countDocuments({ userId: token.sub }) : 0
      })
    }
  )
  .get(
    '/session/:id',
    verifyPermission({ path: '/user/session', securityLevel: SecurityLevels.SL2 }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      const session = await app.db.sessions.findOne({ _id: id, userId: token.sub })
      if (!session) throw new BusinessError('NOT_FOUND', {})
      return ctx.json({ session })
    }
  )
  .get(
    '/session/:id/token',
    verifyPermission({ path: '/user/session/token', securityLevel: SecurityLevels.SL2 }),
    idParamValidator,
    pageQueryValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      const { skip, limit, count } = ctx.req.valid('query')
      const tokens = await app.db.tokens
        .find(
          { sessionId: id, userId: token.sub },
          { skip, limit, projection: { refreshToken: 0 } }
        )
        .toArray()
      return ctx.json({
        tokens,
        count: count ? await app.db.tokens.countDocuments({ sessionId: id, userId: token.sub }) : 0
      })
    }
  )
  .post(
    '/session/:id/token/:tokenId/terminate',
    verifyPermission({ path: '/user/session/edit', securityLevel: SecurityLevels.SL2 }),
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
    '/session/:id/terminate',
    verifyPermission({ path: '/user/session/edit', securityLevel: SecurityLevels.SL2 }),
    idParamValidator,
    async (ctx) => {
      const { id } = ctx.req.valid('param')
      const { app, token } = ctx.var
      const session = await app.db.sessions.findOne({ _id: id, userId: token.sub })
      if (!session) throw new BusinessError('NOT_FOUND', {})
      await app.db.sessions.updateOne({ _id: id }, { $set: { terminated: true } })
      await app.db.tokens.updateMany({ sessionId: id }, { $set: { terminated: true } })
      return ctx.json({})
    }
  )

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
      if (!clientApp || !user) throw new BusinessError('NOT_FOUND', {})
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
