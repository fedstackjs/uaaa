import { Hono } from 'hono'
import { verifyAdmin, verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { SecurityLevels } from '../../util/index.js'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { randomBytes } from 'crypto'
import { tAppManifest } from '../../db/index.js'
import { idParamValidator } from '../_common.js'

export const consoleApi = new Hono()
  .use(verifyAuthorizationJwt)
  .use(verifyPermission({ securityLevel: SecurityLevels.SL4 }))
  .use(verifyAdmin)
  .get('/', verifyPermission({ path: '/console/info' }), async (ctx) => {
    //
  })

  // App api
  .route(
    '/app',
    new Hono()
      .use(verifyPermission({ path: '/console/app' }))
      .get('/', async (ctx) => {
        const { app } = ctx.var
        const apps = await app.db.apps.find({}).toArray()
        return ctx.json({ apps })
      })
      .post(
        '/',
        arktypeValidator('json', tAppManifest.onDeepUndeclaredKey('delete')),
        async (ctx) => {
          const { app } = ctx.var
          const { appId, ...newApp } = ctx.req.valid('json')
          const secret = randomBytes(32).toString('hex')
          const { insertedId } = await app.db.apps.insertOne(
            { _id: appId, ...newApp, secret },
            { ignoreUndefined: true }
          )
          return ctx.json({ appId: insertedId, secret })
        }
      )
      .patch(
        '/',
        arktypeValidator('json', tAppManifest.onDeepUndeclaredKey('delete')),
        async (ctx) => {
          const { app } = ctx.var
          const { appId, ...update } = ctx.req.valid('json')
          await app.db.apps.updateOne({ _id: appId }, { $set: update }, { ignoreUndefined: true })
          return ctx.json({})
        }
      )
      .put('/:id/secret', idParamValidator, async (ctx) => {
        const { app } = ctx.var
        const { id } = ctx.req.valid('param')
        const secret = randomBytes(32).toString('hex')
        await app.db.apps.updateOne({ _id: id }, { $set: { secret } })
        return ctx.json({ secret })
      })
      .put('/:id/enable', idParamValidator, async (ctx) => {
        const { app } = ctx.var
        const { id } = ctx.req.valid('param')
        await app.db.apps.updateOne({ _id: id }, { $unset: { disabled: '' } })
        await app.db.installations.updateMany({ appId: id }, { $unset: { disabled: '' } })
        return ctx.json({})
      })
      .put('/:id/disable', idParamValidator, async (ctx) => {
        const { app } = ctx.var
        const { id } = ctx.req.valid('param')
        await app.db.tokens.updateMany({ appId: id }, { $set: { terminated: true } })
        await app.db.installations.updateMany({ appId: id }, { $set: { disabled: true } })
        await app.db.apps.updateOne({ _id: id }, { $set: { disabled: true } })
        return ctx.json({})
      })
  )

export type IConsoleApi = typeof consoleApi
