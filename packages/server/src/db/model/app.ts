import type { SecurityLevel } from '../../util/index.js'

export interface IAppProvidedPermission {
  name: string
  description: string
  path: string
}

export interface IAppRequestedClaim {
  name: string
  required?: true | undefined
  verified?: true | undefined
}

export interface IAppRequestedPermission {
  perm: string
  reason: string
  required?: true | undefined
}

export interface IAppDoc {
  /** The app id is the unique app id [a-zA-Z._-]+ */
  _id: string

  name: string
  description?: string

  providedPermissions: IAppProvidedPermission[]

  requestedClaims: IAppRequestedClaim[]
  requestedPermissions: IAppRequestedPermission[]

  callbackUrls: string[]
  secret: string

  promoted?: true | undefined

  disabled?: true | undefined
  /** Max security level can be hold by this app */
  securityLevel: SecurityLevel
}
