import { Hono } from 'hono'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'

export const consoleApi = new Hono()
  .use(verifyAuthorizationJwt)
  .use(verifyPermission({ securityLevel: 2 }))
  .get('/', verifyPermission({ path: 'uaaa/console/info' }), async (ctx) => {
    //
  })

export type IConsoleApi = typeof consoleApi
