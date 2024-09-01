import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { idParamValidator } from '../_common.js'

export const userApi = new Hono()
  .use(verifyAuthorizationJwt)
  .use(verifyPermission({ securityLevel: 1 }))

  // Summary API
  .get('/', verifyPermission({ path: '/uaaa/user' }), async (ctx) => {
    return ctx.json({})
  })

  // Claim API
  .get('/claims', verifyPermission({ path: '/uaaa/user/claims' }), async (ctx) => {
    const { app, token } = ctx.var
    const user = await app.db.users.findOne({ _id: token.sub })
    if (!user) throw new HTTPException(404)
    return ctx.json({ claims: await app.claim.filterClaimsForUser(ctx, user.claims) })
  })
  .patch(
    '/claims',
    verifyPermission({ path: '/uaaa/user/claims/edit' }),
    arktypeValidator(
      'json',
      type({
        name: 'string',
        value: 'string'
      })
    ),
    async (ctx) => {
      const { app, token } = ctx.var
      const { name, value } = ctx.req.valid('json')
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
  .get('/session', verifyPermission({ path: '/uaaa/user/session' }), async (ctx) => {
    //
  })
  .get('/session/:id', verifyPermission({ path: '/uaaa/user/session' }), async (ctx) => {
    //
  })
  .post('/session/:id/terminate', verifyPermission({ path: '/uaaa/user/edit' }), async (ctx) => {
    //
  })

  // Installation API
  .get('/installation', async (ctx) => {
    //
  })
  .get('/installation/:id', async (ctx) => {
    //
  })
  .put(
    '/installation',
    verifyPermission({ path: '/uaaa/user/installation/edit' }),
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

  // Credential API
  .get('/credential', verifyPermission({ path: '/uaaa/user/credential' }), async (ctx) => {
    const credentials = await ctx.var.app.db.credentials
      .find({ userId: ctx.var.token.sub }, { projection: { secret: 0 } })
      .toArray()
    return ctx.json({ credentials })
  })
  .delete(
    '/credential',
    verifyPermission({ path: '/uaaa/user/credential/edit' }),
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
  .get(
    '/credential/bind',
    verifyPermission({ path: '/uaaa/user/credential/edit' }),
    async (ctx) => {
      const { credential } = ctx.var.app
      const types = await credential.getBindTypes(ctx, ctx.var.token.sub)
      return ctx.json({ types })
    }
  )
  .put(
    '/credential/bind',
    verifyPermission({ path: '/uaaa/user/credential/edit' }),
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
    verifyPermission({ path: '/uaaa/user/credential' }),
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
    verifyPermission({ path: '/uaaa/user/credential' }),
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
