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
    'count?': type('string.integer.parse')
      .narrow((v) => 0 <= v && v <= 1)
      .pipe((v) => !!v)
  })
)

declare module '../index.js' {
  interface IHookMap {
    'route:extendGlobal'(parent: Hono): void
    'route:extendPlugin'(parent: Hono): void
  }
}
