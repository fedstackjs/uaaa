import { IClaimNames } from '../../claim/index.js'

export interface IClaim {
  value: string
  verified?: true | undefined
}

export type UserClaims = {
  [key in keyof IClaimNames]: IClaimNames[key] extends infer T
    ? T extends string
      ? IClaim
      : IClaim | undefined
    : never
}

export interface IUserDoc {
  /** The union id is the unique user id */
  _id: string

  /** User attributes */
  claims: UserClaims

  salt: string

  /** Max security level can be provided by authenticating with this user */
  securityLevel: number
}
