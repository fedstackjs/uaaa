import type { SecurityLevel } from '../../util/index.js'
import type { IClaimNames } from '../../claim/index.js'

export interface IClaim {
  value: string
  verified?: true | undefined
}

export type IUserClaims = {
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
  claims: IUserClaims

  salt: string

  disabled?: true | undefined
}
