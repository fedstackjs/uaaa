import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { tSecurityLevel } from '../../util/index.js'
import { tDeriveOptions, tRemoteResponse } from '../../session/index.js'

export const sessionApi = new Hono()
  .use(verifyAuthorizationJwt)
  /** Get session info */
  .get('/', verifyPermission({ path: '/session' }), async (ctx) => {
    const { app, token } = ctx.var
    const session = await app.db.sessions.findOne({ _id: token.sid, terminated: { $ne: true } })
    if (!session) throw new HTTPException(404)
    return ctx.json({
      authorizedApps: session.authorizedApps
    })
  })
  /** Get session claims */
  .get('/claim', verifyPermission({ path: '/session/claim' }), async (ctx) => {
    const { app, token } = ctx.var
    const { client_id } = token
    if (!client_id) {
      const user = await app.db.users.findOne({ _id: token.sub })
      if (!user) throw new HTTPException(404)
      const claims = await app.claim.filterBasicClaims(ctx, user.claims)
      return ctx.json({ claims })
    }
    const installation = await app.db.installations.findOne({
      appId: client_id,
      userId: token.sub,
      disabled: { $ne: true }
    })
    const clientApp = await app.db.apps.findOne({ _id: client_id, disabled: { $ne: true } })
    const user = await app.db.users.findOne({ _id: token.sub })
    if (!installation || !clientApp || !user) throw new HTTPException(404)
    const claims = await app.claim.filterClaimsForApp(
      ctx,
      installation.grantedClaims,
      clientApp.requestedClaims,
      user.claims
    )
    return ctx.json({ claims })
  })
  .get(
    '/elevate',
    verifyPermission({ path: '/session/elevate' }),
    arktypeValidator(
      'query',
      type({
        targetLevel: type('string.integer.parse').to(tSecurityLevel)
      })
    ),
    async (ctx) => {
      const { targetLevel } = ctx.req.valid('query')
      const types = await ctx.var.app.credential.getVerifyTypes(ctx, ctx.var.token.sub, targetLevel)
      return ctx.json({ types })
    }
  )
  .post(
    '/elevate',
    verifyPermission({ path: '/session/elevate' }),
    arktypeValidator(
      'json',
      type({
        type: 'string',
        targetLevel: tSecurityLevel,
        payload: 'unknown'
      })
    ),
    async (ctx) => {
      const { type, payload, targetLevel } = ctx.req.valid('json')
      const { credential, session } = ctx.var.app
      const verifyResult = await credential.handleVerify(
        ctx,
        type,
        ctx.var.token.sub,
        targetLevel,
        payload
      )
      return ctx.json(await session.elevate(ctx.var.token, verifyResult, {}))
    }
  )
  .post(
    '/derive',
    verifyPermission({ path: '/session/derive' }),
    arktypeValidator('json', tDeriveOptions),
    async (ctx) => {
      const { session } = ctx.var.app
      return ctx.json(await session.derive(ctx.var.token, ctx.req.valid('json'), {}))
    }
  )
  .post(
    '/try_derive',
    verifyPermission({ path: '/session/derive' }),
    arktypeValidator('json', tDeriveOptions),
    async (ctx) => {
      const { session } = ctx.var.app
      const { permissions } = await session.checkDerive(ctx.var.token, ctx.req.valid('json'))
      return ctx.json({
        permissions
      })
    }
  )
  .post(
    '/remote_authorize',
    verifyPermission({ path: '/session/remote_authorize' }),
    arktypeValidator('json', type({ userCode: 'string', response: tRemoteResponse })),
    async (ctx) => {
      const { userCode, response } = ctx.req.valid('json')
      await ctx.var.app.session.remoteUserAuthorize(userCode, response)
      return ctx.json({})
    }
  )
  .post(
    '/remote_authorize_activate',
    verifyPermission({ path: '/session/remote_authorize' }),
    arktypeValidator('json', type({ userCode: 'string' })),
    async (ctx) => {
      const { userCode } = ctx.req.valid('json')
      await ctx.var.app.session.activateRemoteCode(userCode)
      return ctx.json({})
    }
  )
  .post(
    '/remote_authorize_poll',
    verifyPermission({ path: '/session/remote_authorize' }),
    arktypeValidator('json', type({ userCode: 'string' })),
    async (ctx) => {
      const { userCode } = ctx.req.valid('json')
      return ctx.json(await ctx.var.app.session.remoteUserPoll(userCode))
    }
  )

export type ISessionApi = typeof sessionApi
