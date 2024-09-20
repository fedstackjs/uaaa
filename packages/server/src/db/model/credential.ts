import type { SecurityLevel } from '../../util/index.js'

export interface ICredentialTypeMap {}

export type CredentialType = keyof ICredentialTypeMap

export interface ICredentialDoc {
  _id: string

  /** The union id is the unique user id */
  userId: string

  /** the credential type eg. password, otp, email, ... */
  type: CredentialType

  userIdentifier?: string | undefined
  globalIdentifier?: string | undefined

  /** The **public** data of the credential, eg. email addr */
  data: string

  /** The **secret** data of the credential, eg. password */
  secret: unknown

  /** remark */
  remark: string

  /** The credential is valid after this time */
  validAfter: number

  /** The credential is valid before this time */
  validBefore: number

  /** The credential will only be valid for this count */
  validCount: number

  createdAt: number

  updatedAt: number

  lastAccessedAt?: number
  accessedCount?: number

  disabled?: true | undefined
  /** Max security level can be provided by authenticating with this credential */
  securityLevel: SecurityLevel
}
