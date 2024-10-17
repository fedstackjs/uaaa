import micromatch from 'micromatch'

export interface AppPermissionPaths {
  [path: string]: string
}

export class Permission<AppId extends string = string> {
  static fromFullURL<AppId extends string = string>(url: URL | string) {
    return new Permission<AppId>(new URL(url))
  }

  static fromCompactString<AppId extends string = string>(str: string) {
    return Permission.fromFullURL<AppId>(`uperm://${str}`)
  }

  static fromScopedString<AppId extends string>(str: string, appId: AppId) {
    return Permission.fromFullURL<AppId>(`uperm://${appId}${str}`)
  }

  private constructor(private url: URL) {}

  get appId() {
    return this.url.host
  }

  get path() {
    return this.url.pathname || '/'
  }

  get params() {
    return this.url.searchParams
  }

  toScopedString() {
    return `${this.path}${this.url.search}`
  }

  toCompactString() {
    return `${this.appId}${this.toScopedString()}`
  }

  toString() {
    return `uperm://${this.appId}${this.toScopedString()}`
  }

  test(path: AppPermissionPaths[AppId]) {
    return micromatch.isMatch(path, this.path)
  }
}
