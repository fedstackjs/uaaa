import { type } from 'arktype'

export enum SecurityLevel {
  /** Actor may hold some of user's credentials */
  SL0 = 0,
  /** Actor hold some of user's credentials and passed verification */
  SL1 = 1,
  /** Actor operates device with associated passkey */
  SL2 = 2,
  /** Actor operates device with associated passkey and user presence */
  SL3 = 3,
  /** Actor operates device with admin-registrated passkey */
  SL4 = 4
}

export function isSecurityLevel(level: number): level is SecurityLevel {
  return Number.isInteger(level) && level >= 0 && level <= 4
}

export const tSecurityLevel = type('number').narrow(isSecurityLevel)
