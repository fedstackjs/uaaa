import { Hono } from 'hono'
import { verifyAdmin, verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { SecurityLevel } from '../../util/index.js'
import { consoleUserApi } from './user.js'
import { consoleAppApi } from './app.js'
import { consoleSystemApi } from './system.js'

export const consoleApi = new Hono()
  .use(verifyAuthorizationJwt)
  .use(verifyPermission({ securityLevel: SecurityLevel.SL4 }))
  .use(verifyAdmin)
  .get('/', verifyPermission({ path: '/console/info' }), async (ctx) => {
    //
  })
  .route('/user', consoleUserApi)
  .route('/app', consoleAppApi)
  .route('/system', consoleSystemApi)

export type IConsoleApi = typeof consoleApi
