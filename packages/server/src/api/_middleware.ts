import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import micromatch from 'micromatch'
import type jwt from 'jsonwebtoken'
import { UAAA, type ITokenPayload } from '../util/index.js'

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
  if (!token) throw new HTTPException(401)
  const { jwt, payload } = await ctx.var.app.token.verify(token)
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
      throw new HTTPException(403)
    }
    if (path !== undefined) {
      const matchedPermissions = ctx.var.token.perm
        .map((perm) => new URL(`uperm://${perm}`))
        .filter(({ host, pathname }) => host === UAAA && micromatch.isMatch(path, pathname))
      if (!matchedPermissions.length) {
        throw new HTTPException(403)
      }
      ctx.set('matchedPermissions', matchedPermissions)
    }
    await next()
  })
