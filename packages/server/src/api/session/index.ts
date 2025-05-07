import { Hono } from 'hono'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { BusinessError, SECURITY_LEVEL, tSecurityLevel } from '../../util/index.js'
import { tDeriveOptions, tRemoteResponse } from '../../session/index.js'

export const sessionApi = new Hono()
  .use(verifyAuthorizationJwt)
  /** Get session info */
  .get('/', verifyPermission({ path: '/session' }), async (ctx) => {
    const { app, token } = ctx.var
    const session = await app.db.sessions.findOne({ _id: token.sid, terminated: { $ne: true } })
    if (!session) throw new BusinessError('NOT_FOUND', { msg: 'Session not found' })
    return ctx.json({
      authorizedApps: session.authorizedApps
    })
  })
  /** Get session claims */
  .get('/claim', verifyPermission({ path: '/session/claim' }), async (ctx) => {
    const { app, token } = ctx.var
    const { client_id } = token
    if (client_id === app.appId) {
      const user = await app.db.users.findOne({ _id: token.sub })
      if (!user) throw new BusinessError('NOT_FOUND', { msg: 'User not found' })
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
    if (!installation) throw new BusinessError('NOT_FOUND', { msg: 'Installation not found' })
    if (!clientApp) throw new BusinessError('NOT_FOUND', { msg: 'Client app not found' })
    if (!user) throw new BusinessError('NOT_FOUND', { msg: 'User not found' })

    const claims = await app.claim.filterClaimsForApp(
      ctx,
      installation.grantedClaims,
      clientApp.requestedClaims,
      user.claims
    )
    return ctx.json({ claims })
  })
  .get(
    '/upgrade',
    verifyPermission({ path: '/session/upgrade', securityLevel: SECURITY_LEVEL.HINT }),
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
    '/upgrade',
    verifyPermission({ path: '/session/upgrade', securityLevel: SECURITY_LEVEL.HINT }),
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
      return ctx.json(await session.upgrade(ctx.var.token, verifyResult, {}))
    }
  )
  .post(
    '/downgrade',
    verifyPermission({ path: '/session/downgrade' }),
    arktypeValidator(
      'json',
      type({
        targetLevel: tSecurityLevel
      })
    ),
    async (ctx) => {
      const { targetLevel } = ctx.req.valid('json')
      const { session } = ctx.var.app
      return ctx.json(await session.downgrade(ctx.var.token, targetLevel, {}))
    }
  )
  .post(
    '/derive',
    verifyPermission({ path: '/session/derive' }),
    arktypeValidator('json', tDeriveOptions),
    async (ctx) => {
      const { session } = ctx.var.app
      // TODO: handle token environment
      return ctx.json(await session.derive(ctx.var.token, ctx.req.valid('json'), {}))
    }
  )
  .post(
    '/try_derive',
    verifyPermission({ path: '/session/derive' }),
    arktypeValidator('json', tDeriveOptions),
    async (ctx) => {
      const { session } = ctx.var.app
      const { permissions } = await session.checkDerive(ctx.var.token, ctx.req.valid('json'), {})
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
  .post(
    '/validate_token',
    verifyPermission({ path: '/session/validate_token' }),
    arktypeValidator(
      'json',
      type({
        token: 'string',
        appId: 'string?',
        ignoreExpiration: 'boolean?'
      })
    ),
    async (ctx) => {
      const { token, appId, ignoreExpiration } = ctx.req.valid('json')
      try {
        const result = await ctx.var.app.token.verify(token, undefined, {
          ignoreExpiration,
          audience: appId
        })
        if (appId) return ctx.json({ appId })
        if (typeof result.payload === 'object') {
          if (typeof result.payload.aud === 'string') {
            return ctx.json({ appId: result.payload.aud })
          }
        }
      } finally {
      }
      return ctx.json({ appId: null })
    }
  )

export type ISessionApi = typeof sessionApi
