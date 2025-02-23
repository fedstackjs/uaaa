import { Hono } from 'hono'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { userClaimApi } from './claim.js'
import { userSessionApi } from './session.js'
import { userInstallationApi } from './installation.js'
import { userCredentialApi } from './credential.js'
import { SECURITY_LEVEL } from '../../util/types.js'

export const userApi = new Hono()
  .use(verifyAuthorizationJwt)
  .use(verifyPermission({ securityLevel: SECURITY_LEVEL.MEDIUM }))

  // Summary API
  .get('/', verifyPermission({ path: '/user' }), async (ctx) => {
    return ctx.json({})
  })

  // Claim API
  .route('/claim', userClaimApi)
  // Session API
  .route('/session', userSessionApi)
  // Installation API
  .route('/installation', userInstallationApi)
  // Credential API
  .route('/credential', userCredentialApi)

export type IUserApi = typeof userApi
