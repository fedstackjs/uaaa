import { Hono } from 'hono'
import { pageQueryValidator } from '../_common.js'
import { verifyPermission } from '../_middleware.js'

export const consoleUserApi = new Hono()
  .use(verifyPermission({ path: '/console/user' }))
  .get('/', pageQueryValidator, async (ctx) => {
    const { app } = ctx.var
    const { skip, limit, count } = ctx.req.valid('query')
    const users = await app.db.users.find({}, { skip, limit }).toArray()
    return ctx.json({ users, count: count ? await app.db.users.countDocuments() : 0 })
  })
