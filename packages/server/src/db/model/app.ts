export interface IAppProvidedPermission {
  name: string
  description: string
  path: string
}

export interface IAppDoc {
  /** The app id is the unique app id [a-zA-Z._-]+ */
  _id: string

  providedPermissions: IAppProvidedPermission[]

  /** App attributes */
  attributes: {
    name: string
    description: string
    [K: string]: string
  }

  callbackUrls: string[]
  secret: string

  /** Max security level can be hold by this app */
  securityLevel: number
}
