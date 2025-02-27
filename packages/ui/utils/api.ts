import type {
  IPublicApi,
  ISessionApi,
  IUserApi,
  IConsoleApi,
  ITokenPayload,
  IClaim,
  ErrorName,
  IErrorMap,
  SecurityLevel,
  IUserClaims
} from '@uaaa/server'
import type { IEmailApi } from '@uaaa/server/lib/plugin/builtin/email'
import type { IWebauthnApi } from '@uaaa/server/lib/plugin/builtin/webauthn'
import { hc } from 'hono/client'

export type { SecurityLevel }

export interface IClientToken {
  token: string
  refreshToken?: string
  decoded: ITokenPayload
}

export interface IUserClaim extends IClaim {
  name: string
}

export class APIError<
  T extends ErrorName | 'UNKNOWN_ERROR' = ErrorName | 'UNKNOWN_ERROR'
> extends Error {
  code: T
  data: T extends ErrorName ? IErrorMap[T] : { msg: string }
  constructor(code: T, data: APIError<T>['data']) {
    super(
      `${code}: ${Object.entries(data)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')}`
    )
    this.code = code
    this.data = data
  }
}

export type APIErrorType = {
  [K in ErrorName | 'UNKNOWN_ERROR']: APIError<K>
}[ErrorName | 'UNKNOWN_ERROR']

export const isAPIError = (err: unknown): err is APIErrorType => err instanceof APIError

const serializer = {
  read: JSON.parse,
  write: JSON.stringify
}

const options = { serializer }

export class ApiManager {
  tokens
  effectiveToken
  appId
  isLoggedIn
  securityLevel
  refreshTokensDebounced
  tokensInit
  claims
  isAdmin

  public
  session
  user
  console

  email
  webauthn

  constructor() {
    this.tokens = useLocalStorage<IClientToken[]>('tokens_v2', [], options)
    this.securityLevel = useLocalStorage<SecurityLevel | -1>('level_v2', -1, options)
    this.effectiveToken = computed<IClientToken | null>(
      () => this.tokens.value[this.securityLevel.value] ?? null
    )
    this.appId = computed(() => this.effectiveToken.value?.decoded.client_id ?? '')
    this.isLoggedIn = computed(() => this.securityLevel.value !== -1)
    this.refreshTokensDebounced = useDebounceFn(
      () => navigator.locks.request(`tokens`, this._refreshTokens.bind(this)),
      1000
    )
    this.tokensInit = navigator.locks.request(`tokens`, this._refreshTokens.bind(this))
    this.claims = useLocalStorage<Partial<IUserClaims>>('session_claims', {}, options)
    this.isAdmin = computed(() => this.claims.value.is_admin?.value === 'true')

    const headers = this.getHeaders.bind(this)
    this.public = hc<IPublicApi>('/api/public')
    this.session = hc<ISessionApi>('/api/session', { headers })
    this.user = hc<IUserApi>('/api/user', { headers })
    this.console = hc<IConsoleApi>('/api/console', { headers })

    this.email = hc<IEmailApi>('/api/plugin/email', { headers })
    this.webauthn = hc<IWebauthnApi>('/api/plugin/webauthn', { headers })

    this.isLoggedIn.value && setTimeout(() => this.getSessionClaims().catch(console.error), 0)
  }

  private async _refreshTokenFor(level: SecurityLevel, now = Date.now()) {
    const token = this.tokens.value[level]
    if (!token) return
    const remaining = token.decoded.exp * 1000 - now
    const lifetime = (token.decoded.exp - token.decoded.iat) * 1000
    if (remaining > lifetime / 2) return
    console.log(`[API] Refreshing token at level ${level}`)
    if (token.refreshToken) {
      try {
        const resp = await this.public.refresh.$post({
          json: { clientId: this.appId.value, refreshToken: token.refreshToken }
        })
        await this.checkResponse(resp)
        const { token: newToken, refreshToken } = await resp.json()
        this.tokens.value[level] = {
          token: newToken,
          refreshToken,
          decoded: ApiManager.parseJwt(newToken)
        }
        console.log(`[API] Token at level ${level} refreshed`)
        return
      } catch (err) {
        if (isAPIError(err) && err.code === 'TOKEN_INVALID_REFRESH') {
          delete this.tokens.value[level].refreshToken
          console.log(`[API] Token ${level} failed to refresh: invalid refreshToken`)
        } else {
          console.log(`[API] Token ${level} failed to refresh: ${this._formatError(err)}`)
        }
      }
    }
    // Token not refreshed, check if it is expired
    if (remaining < 3 * 1000) {
      console.log(`[API] Token at level ${level} dropped remaining=${remaining}ms`)
      delete this.tokens.value[level]
    }
  }

  /**
   * Refresh tokens if needed and drop expired tokens
   */
  private async _refreshTokens() {
    if (this.securityLevel.value === null) return
    const now = Date.now()
    console.group(`[API] Refreshing tokens at ${now}`)
    await Promise.all(
      Array.from({ length: this.securityLevel.value + 1 }, (_, i) =>
        this._refreshTokenFor(i as SecurityLevel, now)
      )
    )
    console.log(`[API] Calculating Security Level`)
    const level = this.tokens.value.reduce((acc: -1 | SecurityLevel, token, i) => {
      if (token && token.decoded.exp * 1000 > now) return i as SecurityLevel
      return acc
    }, -1)
    console.log(`[API] Security Level is ${level}`)
    this.securityLevel.value = level
    console.groupEnd()
  }

  private async _downgradeTokenFrom(level: SecurityLevel) {
    console.log(`[API] Downgrading token to level ${level}`)
    try {
      const resp = await this.session.downgrade.$post({ json: { targetLevel: level } })
      await this.checkResponse(resp)
      const {
        token: { token, refreshToken }
      } = await resp.json()
      this.tokens.value[level] = { token, refreshToken, decoded: ApiManager.parseJwt(token) }
    } catch (err) {
      console.log(`[API] Token downgrade failed: ${this._formatError(err)}`)
    }
  }

  /**
   * Fill token store
   */
  private async _applyToken(token: string, refreshToken?: string) {
    const decoded = ApiManager.parseJwt(token)
    const { jti, level } = decoded
    console.group(`[API] Applying token ${jti}`)
    this.tokens.value[level] = { token, refreshToken, decoded }
    this.securityLevel.value = level
    await Promise.all(
      Array.from({ length: level }, (_, i) => this._downgradeTokenFrom(i as SecurityLevel))
    )
    console.groupEnd()
  }

  async getHeaders() {
    await this.tokensInit
    this.refreshTokensDebounced()
    const headers: Record<string, string> = Object.create(null)
    const token = this.effectiveToken.value
    if (token) headers.Authorization = `Bearer ${token.token}`
    return headers
  }

  async login(type: string, payload: unknown) {
    const resp = await this.public.login.$post({ json: { type, payload } })
    await this.checkResponse(resp)
    const {
      token: { token, refreshToken }
    } = await resp.json()
    await navigator.locks.request(`tokens`, () => this._applyToken(token, refreshToken))
    await this.getSessionClaims()
  }

  async verify(type: string, targetLevel: SecurityLevel, payload: unknown) {
    console.log(`[API] Will verify credential ${type}`)
    const resp = await this.session.upgrade.$post({ json: { type, targetLevel, payload } })
    await this.checkResponse(resp)
    const {
      token: { token, refreshToken }
    } = await resp.json()
    await navigator.locks.request(`tokens`, () => this._applyToken(token, refreshToken))
    await this.getSessionClaims()
  }

  async logout() {
    console.log(`[API] Will logout`)
    await navigator.locks.request(`tokens`, async () => {
      console.log(`[API] Logging out`)
      this.tokens.value = []
      this.securityLevel.value = null
      this.claims.value = {}
    })
    window.open('/', '_self')
  }

  async getSessionClaims(): Promise<IUserClaim[]> {
    const resp = await api.session.claim.$get()
    await this.checkResponse(resp)
    const { claims } = await resp.json()
    this.claims.value = {
      ...this.claims.value,
      ...claims
    }
    return Object.entries(claims).map(([name, claim]) => ({ name, ...claim }))
  }

  async getUserClaims(): Promise<IUserClaim[]> {
    const resp = await api.user.claim.$get()
    const { claims } = await resp.json()
    this.claims.value = {
      ...this.claims.value,
      ...claims
    }
    return Object.entries(claims).map(([name, claim]) => ({ name, ...claim }))
  }

  async getError(resp: Response): Promise<APIErrorType> {
    try {
      // For arktype validator error
      const { code, data, errors, success } = await resp.json()
      if (errors && success === false) {
        return new APIError('INVALID_TYPE', { summary: '' })
      }
      return new APIError(code, data)
    } catch (err) {
      return new APIError('UNKNOWN_ERROR', { msg: this._formatError(err) })
    }
  }

  async checkResponse(resp: Response) {
    if (resp.ok) return
    throw await this.getError(resp)
  }

  private _formatError(err: unknown) {
    return err instanceof Error ? err.message : `${err}`
  }

  static parseJwt(token: string) {
    return JSON.parse(atob(token.split('.')[1])) as ITokenPayload
  }
}

export const api = new ApiManager()
