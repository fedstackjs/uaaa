import { ObjectId } from 'mongodb'

export interface ISessionDoc {
  _id: string

  /** The session's user's union id */
  userId: string

  tokenCount: number

  terminated?: boolean
}

export interface ISessionTokenDoc {
  _id: string
  sessionId: string
  index: number
  targetAppId?: string | undefined
  clientAppId?: string | undefined
  permissions: string[]
  securityLevel: number
  createdAt: number
  expiresAt: number
  refreshCount: number
  refreshToken?: string | undefined
  refreshExpiresAt?: number | undefined
}
