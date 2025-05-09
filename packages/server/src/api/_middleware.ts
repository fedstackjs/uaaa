import { createMiddleware } from 'hono/factory'
import type jwt from 'jsonwebtoken'
import {
  BusinessError,
  Permission,
  SECURITY_LEVEL,
  type UAAAPermissionPath
} from '../util/index.js'
import type { ITokenPayload } from '../token/index.js'
export { arktypeValidator } from '@hono/arktype-validator'

declare module 'hono' {
  interface ContextVariableMap {
    jwt: jwt.Jwt
    token: ITokenPayload
    matchedPermissions: Permission[]
  }
}

export const verifyAuthorizationJwt = createMiddleware(async (ctx, next) => {
  const header = ctx.req.header('Authorization')
  const token = header?.split(' ')[1]
  if (!token) {
    throw new BusinessError('FORBIDDEN', {
      msg: 'Missing Authorization header'
    })
  }
  const { jwt, payload } = await ctx.var.app.token.verifyUAAAToken(token)
  ctx.set('jwt', jwt)
  ctx.set('token', payload)
  await next()
})

export interface IVerifyPermissionOptions {
  path?: UAAAPermissionPath
  securityLevel?: number
}

export const verifyPermission = ({
  path,
  securityLevel = SECURITY_LEVEL.LOW
}: IVerifyPermissionOptions) =>
  createMiddleware(async (ctx, next) => {
    if (ctx.var.token.level < securityLevel) {
      throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', {
        required: securityLevel
      })
    }
    if (path !== undefined) {
      const matchedPermissions = ctx.var.token.perm
        .map((p) => Permission.fromScopedString(p, ctx.var.app.appId))
        .filter((p) => p.test(path))
      if (!matchedPermissions.length) {
        throw new BusinessError('INSUFFICIENT_PERMISSION', {
          required: [path]
        })
      }
      ctx.set('matchedPermissions', matchedPermissions)
    }
    await next()
  })

export const verifyAdmin = createMiddleware(async (ctx, next) => {
  const { app, token } = ctx.var
  const user = await app.db.users.findOne(
    { _id: token.sub },
    { projection: { 'claims.is_admin': 1 } }
  )
  if (!user || user.claims.is_admin?.value !== 'true') {
    throw new BusinessError('REQUIRE_ADMIN', {})
  }
  await next()
})
