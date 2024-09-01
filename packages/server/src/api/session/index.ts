import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { verifyAuthorizationJwt, verifyPermission } from '../_middleware.js'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import ms from 'ms'
import { BusinessError, UAAA } from '../../util/index.js'
import { tSecurityLevel } from '../../util/index.js'

export const sessionApi = new Hono()
  .use(verifyAuthorizationJwt)
  /** Get session info */
  .get('/', verifyPermission({ path: '/session' }), async (ctx) => {
    const { app, token } = ctx.var
    const session = await app.db.sessions.findOne({ _id: token.sid, terminated: { $ne: true } })
    if (!session) throw new HTTPException(404)
    return ctx.json({
      tokenCount: session.tokenCount,
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
        targetLevel: type('string.numeric.parse').to(tSecurityLevel)
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
      const { credential, db, token, config } = ctx.var.app
      const { securityLevel, expiresIn } = await credential.handleVerify(
        ctx,
        type,
        ctx.var.token.sub,
        targetLevel,
        payload
      )
      const session = await db.sessions.findOneAndUpdate(
        { _id: ctx.var.token.sid, terminated: { $ne: true } },
        { $inc: { tokenCount: 1 } },
        { returnDocument: 'before' }
      )
      if (!session) throw new HTTPException(401)
      const timestamp = Date.now()
      return ctx.json({
        token: await token.createAndSignToken({
          sessionId: ctx.var.token.sid,
          userId: ctx.var.token.sub,
          permissions: ['uaaa/**'],
          index: session.tokenCount,
          securityLevel,
          createdAt: timestamp,
          expiresAt: timestamp + expiresIn,
          tokenTimeout: ms(config.get('tokenTimeout')),
          refreshTimeout: ms(config.get('refreshTimeout'))
        })
      })
    }
  )
  .post(
    '/derive',
    verifyPermission({ path: '/session/derive' }),
    arktypeValidator(
      'json',
      type({
        'targetAppId?': 'string',
        clientAppId: 'string',
        securityLevel: tSecurityLevel
      })
    ),
    async (ctx) => {
      const { targetAppId, clientAppId, securityLevel } = ctx.req.valid('json')
      const { app, token } = ctx.var
      if (token.client_id && !targetAppId) {
        throw new HTTPException(403, {
          message: 'Secondary token can only derive application token'
        })
      }
      if (securityLevel > token.level) {
        throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', { required: securityLevel })
      }

      const clientApp = await app.db.apps.findOne({ _id: clientAppId, disabled: { $ne: true } })
      if (!clientApp) throw new BusinessError('NOT_FOUND', {})
      if (securityLevel > clientApp.securityLevel) {
        throw new BusinessError('BAD_REQUEST', {
          msg: 'Security level higher than client app'
        })
      }

      const installation = await app.db.installations.findOne({
        userId: token.sub,
        appId: clientAppId,
        disabled: { $ne: true }
      })
      if (!installation) {
        throw new BusinessError('APP_NOT_INSTALLED', {})
      }

      const permHost = targetAppId ?? UAAA
      const permissions = installation.grantedPermissions.filter(
        (perm) => new URL(`uperm://${perm}`).host === permHost
      )
      if (!permissions.length) {
        throw new BusinessError('BAD_REQUEST', {
          msg: 'No permissions granted for target app'
        })
      }

      const timestamp = Date.now()
      const parentToken = await app.db.tokens.findOne({
        _id: token.jti,
        expiresAt: { $gt: timestamp },
        terminated: { $ne: true }
      })
      if (!parentToken) {
        throw new BusinessError('BAD_REQUEST', {
          msg: 'Parent token not found'
        })
      }

      const session = await app.db.sessions.findOneAndUpdate(
        { _id: token.sid, terminated: { $ne: true } },
        {
          $inc: { tokenCount: 1 },
          $addToSet: { authorizedApps: clientAppId }
        },
        { returnDocument: 'before' }
      )
      if (!session) {
        throw new BusinessError('BAD_REQUEST', {
          msg: 'Session not found'
        })
      }

      const { _id } = await app.token.createToken({
        sessionId: token.sid,
        userId: token.sub,
        index: session.tokenCount,
        targetAppId,
        clientAppId,
        permissions,
        securityLevel,
        createdAt: timestamp,
        expiresAt: parentToken.expiresAt,
        // TODO: tokenTimeout and refreshTimeout should be configurable
        tokenTimeout: parentToken.tokenTimeout,
        refreshTimeout: parentToken.refreshTimeout
      })
      return ctx.json({ tokenId: _id })
    }
  )

export type ISessionApi = typeof sessionApi
