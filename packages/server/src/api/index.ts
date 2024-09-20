import { Hono } from 'hono'
import { sessionApi } from './session/index.js'
import { userApi } from './user/index.js'
import { consoleApi } from './console/index.js'
import { publicApi } from './public/index.js'
import { HTTPException } from 'hono/http-exception'
import { MongoServerError } from 'mongodb'
import { BusinessError } from '../util/errors.js'

export const rootApi = new Hono()
  .route('/public', publicApi)
  .route('/session', sessionApi)
  .route('/user', userApi)
  .route('/console', consoleApi)
  .onError((err, ctx) => {
    if (err instanceof HTTPException) return err.getResponse()
    if (err instanceof MongoServerError) {
      if (err.code === 11000) {
        return new BusinessError('DUPLICATE', { msg: 'Duplicate value' }).getResponse()
      }
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new BusinessError('INTERNAL_ERROR', { msg }).getResponse()
  })

export type IRootApi = typeof rootApi

export * from './_common.js'
export * from './_middleware.js'
export * from './_helper.js'
export * from './console/index.js'
export * from './public/index.js'
export * from './session/index.js'
export * from './user/index.js'
