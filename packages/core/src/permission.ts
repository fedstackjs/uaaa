export interface AppPermissionPaths {
  [path: string]: string
}

export const rePermissionPath = // Safe regex, liner complexity
  /^(?:\/[a-zA-Z0-9_-]+)+$/
export const rePermissionPathMatcher = // Safe regex, liner complexity
  /^\/(?:(?:[\w-]*\*[\w-]*|[\w-]+)\/)*(?:\*\*|[\w-]*\*[\w-]*|[\w-]+)$/

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
 */
export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function compilePathMatcher(matcher: string) {
  const re = escapeRegExp(matcher)
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*')
  return new RegExp(`^${re}$`)
}

export function matchPath(path: string, matcher: string) {
  return compilePathMatcher(matcher).test(path)
}

export class Permission<AppId extends string = string> {
  static fromFullURL<AppId extends string = string>(url: URL | string, matcher = true) {
    return new Permission<AppId>(new URL(url), matcher)
  }

  static fromCompactString<AppId extends string = string>(str: string, matcher = true) {
    return Permission.fromFullURL<AppId>(`uperm://${str}`, matcher)
  }

  static fromScopedString<AppId extends string>(str: string, appId: AppId, matcher = true) {
    return Permission.fromFullURL<AppId>(`uperm://${appId}${str}`, matcher)
  }

  private constructor(
    private url: URL,
    private matcher: boolean
  ) {
    const re = matcher ? rePermissionPathMatcher : rePermissionPath
    if (!re.test(this.path)) {
      throw new Error(`Invalid permission path: ${this.path}`)
    }
  }

  get appId() {
    return this.url.host
  }

  get path() {
    return this.url.pathname
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
    return matchPath(path, this.path)
  }
}
