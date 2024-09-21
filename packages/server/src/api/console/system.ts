import { Hono } from 'hono'
import { verifyPermission } from '../_middleware.js'
import { pageQueryValidator } from '../_common.js'

export const consoleSystemApi = new Hono()
  .use(verifyPermission({ path: '/console/system' }))
  .get('/', pageQueryValidator, async (ctx) => {
    const { app } = ctx.var
    const { skip, limit, count } = ctx.req.valid('query')
    const docs = await app.db.system.find({}, { skip, limit }).toArray()
    return ctx.json({ docs, count: count ? await app.db.system.countDocuments() : 0 })
  })
