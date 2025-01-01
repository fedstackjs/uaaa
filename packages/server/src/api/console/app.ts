import { randomBytes } from 'node:crypto'
import { arktypeValidator } from '@hono/arktype-validator'
import { Hono } from 'hono'
import { tAppManifest } from '../../db/index.js'
import { idParamValidator } from '../_common.js'
import { verifyPermission } from '../_middleware.js'
import { BusinessError } from '../../util/errors.js'

export const consoleAppApi = new Hono()
  .use(verifyPermission({ path: '/console/app' }))
  .get('/', async (ctx) => {
    const { app } = ctx.var
    const apps = await app.db.apps.find({}, { projection: { secret: 0 } }).toArray()
    return ctx.json({ apps })
  })
  .post('/', arktypeValidator('json', tAppManifest.onDeepUndeclaredKey('delete')), async (ctx) => {
    const { app } = ctx.var
    const { appId, ...newApp } = ctx.req.valid('json')
    if (appId === app.appId) {
      throw new BusinessError('DUPLICATE', {
        msg: 'appId cannot be the same as the UAAA app'
      })
    }
    const secret = randomBytes(32).toString('hex')
    const { insertedId } = await app.db.apps.insertOne(
      { _id: appId, ...newApp, secret },
      { ignoreUndefined: true }
    )
    return ctx.json({ appId: insertedId, secret })
  })
  .patch(
    '/:id',
    idParamValidator,
    arktypeValidator('json', tAppManifest.onDeepUndeclaredKey('delete')),
    async (ctx) => {
      const { app } = ctx.var
      const { id } = ctx.req.valid('param')
      const { appId, ...update } = ctx.req.valid('json')
      if (appId && appId !== id) {
        throw new BusinessError('BAD_REQUEST', { msg: 'appId in body must match id in path' })
      }
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
    return ctx.json({})
  })
  .put('/:id/disable', idParamValidator, async (ctx) => {
    const { app } = ctx.var
    const { id } = ctx.req.valid('param')
    await app.db.apps.updateOne({ _id: id }, { $set: { disabled: true } })
    await app.db.tokens.updateMany({ appId: id }, { $set: { terminated: true } })
    return ctx.json({})
  })
  .delete('/:id', idParamValidator, async (ctx) => {
    const { app } = ctx.var
    const { id } = ctx.req.valid('param')
    await app.db.apps.deleteOne({ _id: id })
    await app.db.installations.deleteMany({ appId: id })
    await app.db.tokens.updateMany({ appId: id }, { $set: { terminated: true } })
    return ctx.json({})
  })
