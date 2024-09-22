import type { ICommonDocument } from '../_common.js'

export interface IInstallationDoc extends ICommonDocument {
  appId: string
  userId: string
  grantedPermissions: string[]
  grantedClaims: string[]
  createdAt: number
  updatedAt: number
  disabled?: true | undefined
}
