export interface ITokenDoc {
  /** Token ID */
  _id: string
  /** Session ID */
  sessionId: string
  /** User ID */
  userId: string
  /** Token Index in a session */
  index: number
  /** Token Target AppID (empty when token is issued for UAAA) */
  targetAppId?: string | undefined
  /** Token Client AppID (empty when token is issued for UAAA) */
  clientAppId?: string | undefined
  /** Token's permissions. Array of stripped UPM-URLs */
  permissions: string[]
  /** Token's security level' */
  securityLevel: number

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

  terminated?: boolean
}
