import { ObjectId } from 'mongodb'

export interface ISessionDoc {
  _id: string

  /** The session's user's union id */
  userId: string

  operationCount: number

  terminated?: boolean
}

export interface ISessionOperationDoc {
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
}
