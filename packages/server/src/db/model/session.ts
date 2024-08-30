import { ObjectId } from 'mongodb'

export interface ISessionDoc {
  _id: string

  /** The session's user's union id */
  userId: string

  tokenCount: number

  terminated?: boolean
}
