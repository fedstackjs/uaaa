import type { Context } from 'hono'
import { getConnInfo } from '@hono/node-server/conninfo'

export function getUserAgent(ctx: Context) {
  return ctx.req.header('user-agent') || 'unknown'
}

export function getRemoteIP(ctx: Context) {
  const key = ctx.var.app.config.get('realIpHeader')
  const value = key && ctx.req.header(key)
  // NOTE: 127.0.0.1 is set as default value here, which should be further discussed
  return value ?? getConnInfo(ctx).remote.address ?? '127.0.0.1'
}
