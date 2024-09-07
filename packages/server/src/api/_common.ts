import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { Hono } from 'hono'

export const idParamValidator = arktypeValidator(
  'param',
  type({
    id: 'string'
  })
)

export const pageQueryValidator = arktypeValidator(
  'query',
  type({
    skip: 'string.integer.parse',
    limit: type('string.integer.parse').narrow((v) => 5 <= v && v <= 100),
    'count?': 'boolean'
  })
)

declare module '../index.js' {
  interface IHookMap {
    'route:extendGlobal'(parent: Hono): void
    'route:extendPlugin'(parent: Hono): void
  }
}
