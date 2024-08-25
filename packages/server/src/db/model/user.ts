export interface IUserDoc {
  /** The union id is the unique user id */
  _id: string

  /** User attributes */
  claims: {
    username: string
    avatarHash?: string
    [K: string]: string
  }

  /** Max security level can be provided by authenticating with this user */
  securityLevel: number
}
