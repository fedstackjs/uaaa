import { Hono } from 'hono'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'

export const userApi = new Hono()
  .use(verifyAuthorizationJwt)
  .get('/', verifyPermission({ path: 'uaaa/user/claims/read' }), async (ctx) => {
    //
  })
  .get('/session', verifyPermission({ path: 'uaaa/user/session/read' }), async (ctx) => {
    //
  })
  .get('/session/:id', verifyPermission({ path: 'uaaa/user/session' }), async (ctx) => {
    //
  })
  .post('/session/:id/terminate', async (ctx) => {
    //
  })
  .get('/installation', async (ctx) => {
    //
  })
  .get('/installation/:id', async (ctx) => {
    //
  })
  .get('/credential', async (ctx) => {
    //
  })
  .get('/credential/:id', async (ctx) => {
    //
  })

export type IUserApi = typeof userApi
