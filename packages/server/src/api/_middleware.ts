import { createMiddleware } from 'hono/factory'
import type jwt from 'jsonwebtoken'
import { BusinessError, checkPermission } from '../util/index.js'
import { ITokenPayload } from '../token/index.js'
export { arktypeValidator } from '@hono/arktype-validator'

declare module 'hono' {
  interface ContextVariableMap {
    jwt: jwt.Jwt
    token: ITokenPayload
    matchedPermissions: URL[]
  }
}

export const verifyAuthorizationJwt = createMiddleware(async (ctx, next) => {
  const header = ctx.req.header('Authorization')
  const token = header?.split(' ')[1]
  if (!token) throw new BusinessError('TOKEN_REQUIRED', {})
  const { jwt, payload } = await ctx.var.app.token.verifyUAAAToken(token)
  ctx.set('jwt', jwt)
  ctx.set('token', payload)
  await next()
})

export interface IVerifyPermissionOptions {
  path?: string
  securityLevel?: number
}

export const verifyPermission = ({ path, securityLevel }: IVerifyPermissionOptions) =>
  createMiddleware(async (ctx, next) => {
    if (securityLevel !== undefined && ctx.var.token.level < securityLevel) {
      throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', {
        required: securityLevel
      })
    }
    if (path !== undefined) {
      const matchedPermissions = checkPermission(ctx.var.token.perm, path)
      if (!matchedPermissions.length) {
        throw new BusinessError('INSUFFICIENT_PERMISSION', {
          required: path
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
