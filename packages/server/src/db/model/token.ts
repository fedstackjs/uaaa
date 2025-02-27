import type { SecurityLevel } from '../../util/index.js'

export interface ITokenEnvironment {
  ip?: string
  ua?: string
}

/**
 * Token Document
 *
 * Token stores a grant of permission for a client app to access other apps.
 * There are two types of tokens: Session Token and App Token.
 *
 * Token can be created by one of the following methods:
 * - Login: upon successful login, the first Session Token will be created inside the newly created session.
 * - Upgrade: given an effective Session Token and passed verification, a new Session Token with higher security level will be created.
 * - Downgrade: given an effective Session Token, a new Session Token with lower security level will be created.
 * - Derive: given an effective Session Token, a new App Token with the same or lower security level will be created.
 * - Exchange: given an effective App Token, a new App Token with the same or lower security level will be created.
 *
 * By default, an elevated/derived token can only have expire time earlier than its parent token.
 *
 * Diagram:
 * ```
 * >--+ Session Token ------------------+----x
 *    |                                 |
 *    +-+ upgrade -> Session Token -x   | + downgrade ----x
 *      |                               | |
 *      +-+ derive -> App Token ----x   +-+ upgrade -x
 *        |
 *        +- exchange -> App Token ----------x
 * ```
 *
 *
 * UAAA discourages having more than one active token with same `working scope`.
 * - `working scope` is determined by (User, Session, Parent, App, SecurityLevel).
 * - By default, when creating new token whose `working scope` is same as an existing token,
 *   the existing token will be extended and returned.
 * - This is to prevent token proliferation and to simplify token management.
 */
export interface ITokenDoc {
  /** Token ID */
  _id: string
  /** User ID */
  userId: string
  /** Session ID */
  sessionId: string
  /** Token Client AppID */
  appId: string
  /** Token's permissions. Array of compact UPM-URLs */
  permissions: string[]
  /** Token's security level' */
  securityLevel: SecurityLevel
  /** Whether the token is confidential, eg. require client authentication */
  confidential?: boolean | undefined
  /** Whether the token is derived via remote authentication */
  remote?: boolean | undefined

  parentId?: string | undefined
  credentialId?: string | undefined

  createdAt: number
  updatedAt: number
  expiresAt: number
  activatedAt: number
  activatedCount?: number

  /** Refresh Token */
  refreshToken?: string | undefined
  /** Refresh Token expire */
  refreshExpiresAt?: number | undefined
  /** Refresh Token timeout */
  refreshTimeout: number

  /** JWT expires at */
  jwtExpiresAt?: number
  /** JWT timeout */
  jwtTimeout: number

  /** Token's last issue time */
  lastIssuedAt?: number
  /** Token's issue count */
  issuedCount?: number

  terminated?: true | boolean

  /** OpenID related */
  nonce?: string | undefined
  challenge?: string | undefined
  code?: string | undefined

  environment: ITokenEnvironment
}
