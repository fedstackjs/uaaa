import { type } from 'arktype'
import { rAppId, tSecurityLevel, type SecurityLevel } from '../../util/index.js'

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

export const tAppGeneralConfig = type({
  'promoted?': 'boolean',
  'autoInstall?': 'boolean'
})

export type IAppGeneralConfig = typeof tAppGeneralConfig.infer

export const tAppOpenIdConfig = type({
  'additionalClaims?': 'Record<string,string>',
  'allowPublicClient?': 'boolean',
  'minSecurityLevel?': tSecurityLevel
})
export type IAppOpenIdConfig = typeof tAppOpenIdConfig.infer

export const tChangelogItem = type({
  versionName: 'string',
  content: 'string'
})

export const tAppManifest = type({
  appId: type('string').narrow((id) => rAppId.test(id)),
  name: 'string',
  version: type('number').narrow((v) => Number.isSafeInteger(v) && v >= 0),
  'description?': 'string',
  'icon?': 'string',
  providedPermissions: tAppProvidedPermission.array(),
  requestedClaims: tAppRequestedClaim.array(),
  requestedPermissions: tAppRequestedPermission.array(),
  callbackUrls: 'string[]',
  variables: 'Record<string,string>',
  secrets: 'Record<string,string>',
  changelog: tChangelogItem.array(),
  'config?': tAppGeneralConfig,
  'openid?': tAppOpenIdConfig,
  securityLevel: tSecurityLevel
}).narrow((manifest) => manifest.version === manifest.changelog.length)

export type IAppManifest = typeof tAppManifest.infer

export interface IAppDoc {
  /** The app id is the unique app id [a-zA-Z._-]+ */
  _id: string
  version: number

  name: string
  description?: string
  icon?: string

  providedPermissions: IAppProvidedPermission[]

  requestedClaims: IAppRequestedClaim[]
  requestedPermissions: IAppRequestedPermission[]

  callbackUrls: string[]
  variables: Record<string, string>
  secrets: Record<string, string>

  /** Max security level can be hold by this app */
  securityLevel: SecurityLevel

  config?: IAppGeneralConfig
  openid?: IAppOpenIdConfig

  /** Managed properties */
  disabled?: boolean | undefined
  secret: string
}
