export interface ISessionEnvironment {
  ip?: string
  ua?: string
}

export interface ISessionDoc {
  _id: string

  /** The session's user's union id */
  userId: string

  tokenCount: number

  authorizedApps: string[]
  environment: ISessionEnvironment

  createdAt: number
  expiresAt: number

  terminated?: true | boolean
}
