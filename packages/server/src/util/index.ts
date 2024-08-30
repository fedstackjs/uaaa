import { customAlphabet } from 'nanoid'

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const usernameGen = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 8)

export const generateUsername = (suggested: string) => {
  const stripped = suggested.replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 24)
  return stripped + usernameGen()
}

export * from './constants.js'
export * from './logger.js'
