import { ICommonDocument } from '../_common.js'

export interface IInstallationDoc extends ICommonDocument {
  _id: string
  appId: string
  userId: string
  grantedPermissions: string[]
}
