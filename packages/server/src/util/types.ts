import { type } from 'arktype'

export const SECURITY_LEVEL = {
  /**
   * The session is lasting, but cannot determine the user's presence.
   * Given token with this level, Apps can only perform limited operations
   * that do not modify or leak user's data.
   */
  HINT: 0,

  /**
   * User is likely present, but their identity is not ensured.
   * MEDIUM level will be dropped to this level after configured timeout.
   * Application can perform low-privilage operations with this level.
   */
  LOW: 1,

  /**
   * User is technically considered as present, but their identity is not ensured.
   * Weak credentials like password, email OTP or Federated login is required for this level.
   * Application can perform in-session sensitive operations with this level.
   */
  MEDIUM: 2,

  /**
   * User is technically considered as present and have their identity ensured to be authentic.
   * WebAuthn (Hardware Key), Biometric authentication or TOTP is required for this level.
   * Application can perform cross-session sensitive operations with this level.
   */
  HIGH: 3,

  /**
   * User was authenticated with trusted credentials
   * Eg. administrator added hardware key
   */
  MAX: 4
} as const

export type SecurityLevel = (typeof SECURITY_LEVEL)[keyof typeof SECURITY_LEVEL]

export function isSecurityLevel(level: number): level is SecurityLevel {
  return Number.isInteger(level) && level >= SECURITY_LEVEL.HINT && level <= SECURITY_LEVEL.MAX
}

export const tSecurityLevel = type('number').narrow(isSecurityLevel)

export type UAAA = string & { __uaaa: never }
