import { type } from 'arktype'
import { tSecurityLevel, type SecurityLevel } from '../../util/index.js'

export const tAppProvidedPermission = type({
  name: 'string',
  description: 'string',
  path: 'string'
})
export type IAppProvidedPermission = typeof tAppProvidedPermission.infer

export const tAppRequestedClaim = type({
  name: 'string',
  reason: 'string',
  'required?': 'boolean',
  'verified?': 'boolean'
})
export type IAppRequestedClaim = typeof tAppRequestedClaim.infer

export const tAppRequestedPermission = type({
  perm: 'string',
  reason: 'string',
  'required?': 'boolean'
})
export type IAppRequestedPermission = typeof tAppRequestedPermission.infer

export const tAppEnv = type({
  value: 'string'
})
export type IAppEnv = typeof tAppEnv.infer

export const tAppManifest = type({
  appId: 'string',
  name: 'string',
  'description?': 'string',
  providedPermissions: tAppProvidedPermission.array(),
  requestedClaims: tAppRequestedClaim.array(),
  requestedPermissions: tAppRequestedPermission.array(),
  callbackUrls: 'string[]',
  environment: type.Record('string', tAppEnv),
  'promoted?': 'boolean',
  securityLevel: tSecurityLevel
})
export type IAppManifest = typeof tAppManifest.infer

export interface IAppDoc {
  /** The app id is the unique app id [a-zA-Z._-]+ */
  _id: string

  name: string
  description?: string

  providedPermissions: IAppProvidedPermission[]

  requestedClaims: IAppRequestedClaim[]
  requestedPermissions: IAppRequestedPermission[]

  callbackUrls: string[]
  environment: Record<string, IAppEnv>
  secret: string

  promoted?: boolean | undefined

  disabled?: boolean | undefined
  /** Max security level can be hold by this app */
  securityLevel: SecurityLevel
}
