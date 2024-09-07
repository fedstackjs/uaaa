export interface ISessionDoc {
  _id: string

  /** The session's user's union id */
  userId: string

  tokenCount: number

  authorizedApps: string[]

  createdAt: number
  expiresAt: number

  terminated?: true | boolean
}
