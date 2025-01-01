import type { IAppProvidedPermission } from '../db/index.js'
export { Permission } from '@uaaa/core'

declare module '@uaaa/core' {
  interface AppPermissionPaths {
    uaaa: UAAAPermissionPath
  }
}

export const UAAAPermissionDescriptionMap = {
  '/session': { name: 'Get session info', description: '' },
  '/session/claim': { name: 'Get authorized claims', description: '' },
  '/session/elevate': { name: 'Elevate session', description: '' },
  '/session/derive': { name: 'Derive token inside session', description: '' },
  '/session/slient_authorize': { name: 'Allow sliently authorize', description: '' },
  '/session/remote_authorize': { name: 'Authorize remote clients', description: '' },
  '/user': { name: 'Get user info', description: '' },
  '/user/claim': { name: 'Get user claims', description: '' },
  '/user/claim/edit': { name: 'Edit user claims', description: '' },
  '/user/credential': { name: 'Get user credentials', description: '' },
  '/user/credential/edit': { name: 'Edit user credentials', description: '' },
  '/user/installation': { name: 'Get user app installations', description: '' },
  '/user/installation/edit': { name: 'Edit user app installations', description: '' },
  '/user/session': { name: 'Get user sessions', description: '' },
  '/user/session/token': { name: 'Get user session tokens', description: '' },
  '/user/session/edit': { name: 'Edit user sessions', description: '' },
  '/console/info': { name: 'Get system info', description: '' },
  '/console/user': { name: 'Manage users', description: '' },
  '/console/app': { name: 'Manage apps', description: '' },
  '/console/system': { name: 'Manage system', description: '' }
} as const satisfies Record<string, Omit<IAppProvidedPermission, 'path'>>
export type UAAAPermissionPath = keyof typeof UAAAPermissionDescriptionMap
export const UAAAProvidedPermissions: IAppProvidedPermission[] = Object.entries(
  UAAAPermissionDescriptionMap
).map(([path, description]) => ({ path, ...description }))
