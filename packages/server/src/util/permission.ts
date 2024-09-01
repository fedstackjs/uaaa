import micromatch from 'micromatch'
import { UAAA } from './constants.js'

export function checkPermission(permissions: string[], path: string, appId = UAAA) {
  const matchedPermissions = permissions
    .map((perm) => new URL(`uperm://${perm}`))
    .filter(({ host, pathname }) => host === appId && micromatch.isMatch(path, pathname))
  return matchedPermissions
}
