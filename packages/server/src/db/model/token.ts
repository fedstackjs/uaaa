import type { SecurityLevel } from '../../util/index.js'

export interface ITokenEnvironment {
  ip?: string
  ua?: string
}

export interface ITokenDoc {
  /** Token ID */
  _id: string
  /** Session ID */
  sessionId: string
  /** User ID */
  userId: string
  /** Token Client AppID */
  clientAppId: string
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

  /** Token is created at */
  createdAt: number
  /** Token will expire at */
  expiresAt: number

  /** Refresh Token */
  refreshToken?: string | undefined
  /** Refresh Token expire */
  refreshExpiresAt?: number | undefined
  /** Refresh Token timeout */
  refreshTimeout: number

  /** JWT expires at */
  tokenExpiresAt?: number
  /** JWT timeout */
  tokenTimeout: number

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
