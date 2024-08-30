import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { nanoid } from 'nanoid'

export const userApi = new Hono()
  .use(verifyAuthorizationJwt)
  .get('/', verifyPermission({ path: 'uaaa/user' }), async (ctx) => {
    //
  })
  .get('/claims', verifyPermission({ path: 'uaaa/user/claims' }), async (ctx) => {
    const { app, token } = ctx.var
    const user = await app.db.users.findOne({ _id: token.sub })
    if (!user) throw new HTTPException(404)
    return ctx.json({ claims: app.claim.filterClaimsForUser(ctx, user.claims) })
  })
  .patch(
    '/claims',
    verifyPermission({ path: 'uaaa/user/claims/edit' }),
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
        { _id: token.sub, [`claims.${name}.verified`]: { $exists: false } },
        { $set: { [`claims.${name}.value`]: value } }
      )
      return ctx.json({})
    }
  )
  .get('/session', verifyPermission({ path: 'uaaa/user/session' }), async (ctx) => {
    //
  })
  .get('/session/:id', verifyPermission({ path: 'uaaa/user/session' }), async (ctx) => {
    //
  })
  .post('/session/:id/terminate', verifyPermission({ path: 'uaaa/user/edit' }), async (ctx) => {
    //
  })
  .get('/installation', async (ctx) => {
    //
  })
  .get('/installation/:id', async (ctx) => {
    //
  })
  .put(
    '/installation',
    verifyPermission({ path: 'uaaa/user/installation/edit' }),
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
      const clientApp = await app.db.apps.findOne({ _id: appId })
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
  .get('/credential', async (ctx) => {
    //
  })
  .get('/credential/:id', async (ctx) => {
    //
  })

export type IUserApi = typeof userApi
