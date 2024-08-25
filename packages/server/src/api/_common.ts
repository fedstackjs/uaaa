import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { Hono } from 'hono'

export const idParamValidator = arktypeValidator(
  'param',
  type({
    id: 'string'
  })
)

declare module '../index.js' {
  interface IHookMap {
    'route:extendGlobal'(parent: Hono): void
    'route:extendPlugin'(parent: Hono): void
  }
}
