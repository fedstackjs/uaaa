import { customAlphabet } from 'nanoid'

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const usernameGen = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 8)

export const generateUsername = (suggested: string) => {
  const stripped = suggested.replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 20)
  return stripped + '_' + usernameGen()
}

export * from './constants.js'
export * from './errors.js'
export * from './logger.js'
export * from './permission.js'
export * from './types.js'

import * as arktype from 'arktype'
export { arktype }
