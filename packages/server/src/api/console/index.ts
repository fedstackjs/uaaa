import { Hono } from 'hono'
import { verifyAdmin, verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { SecurityLevels } from '../../util/index.js'

export const consoleApi = new Hono()
  .use(verifyAuthorizationJwt)
  .use(verifyPermission({ securityLevel: SecurityLevels.SL4 }))
  .use(verifyAdmin)
  .get('/', verifyPermission({ path: '/uaaa/console/info' }), async (ctx) => {
    //
  })

export type IConsoleApi = typeof consoleApi
