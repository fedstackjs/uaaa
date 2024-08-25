import { Hono } from 'hono'
import { sessionApi } from './session/index.js'
import { userApi } from './user/index.js'
import { consoleApi } from './console/index.js'
import { publicApi } from './public/index.js'

export const rootApi = new Hono()
  .route('/public', publicApi)
  .route('/session', sessionApi)
  .route('/user', userApi)
  .route('/console', consoleApi)

export type IRootApi = typeof rootApi

export * from './_common.js'
export * from './_middleware.js'
export * from './console/index.js'
export * from './public/index.js'
export * from './session/index.js'
export * from './user/index.js'
