import type { ICommonDocument } from '../_common.js'

export interface IInstallationDoc extends ICommonDocument {
  appId: string
  userId: string
  version: number
  grantedPermissions: string[]
  grantedClaims: string[]
  createdAt: number
  updatedAt: number
  disabled?: true | undefined
}
