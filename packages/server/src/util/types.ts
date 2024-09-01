import { type } from 'arktype'

export enum SecurityLevels {
  /** Actor may hold some of user's credentials */
  SL0 = 0,
  /** Actor hold some of user's credentials and passed verification */
  SL1 = 1,
  /** Actor operates device with associated passkey */
  SL2 = 2,
  /** Actor operates device with associated passkey and user presence */
  SL3 = 3
}
export const tSecurityLevel = type('0<=number.integer<=3')
export type SecurityLevel = typeof tSecurityLevel.infer
