import type {
  IPublicApi,
  ISessionApi,
  IUserApi,
  IConsoleApi,
  ITokenPayload,
  IClaim,
  ErrorName,
  IErrorMap
} from '@uaaa/server'
import type { IEmailApi } from '@uaaa/server/lib/plugin/builtin/email'
import type { IWebauthnApi } from '@uaaa/server/lib/plugin/builtin/webauthn'
import { hc } from 'hono/client'

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
  isLoggedIn
  isAdmin
  securityLevel

  public
  session
  user
  console

  email
  webauthn

  constructor() {
    this.tokens = useLocalStorage<Record<string, IClientToken>>('tokens', {}, options)
    this.effectiveToken = useLocalStorage<IClientToken | null>('effectiveToken', null, options)
    this.isAdmin = ref(false)
    this.isLoggedIn = computed(() => !!this.effectiveToken.value)
    this.securityLevel = computed(() => this.effectiveToken.value?.decoded.level ?? 0)

    const headers = this.getHeaders.bind(this)
    this.public = hc<IPublicApi>('/api/public')
    this.session = hc<ISessionApi>('/api/session', { headers })
    this.user = hc<IUserApi>('/api/user', { headers })
    this.console = hc<IConsoleApi>('/api/console', { headers })

    this.email = hc<IEmailApi>('/api/plugin/email', { headers })
    this.webauthn = hc<IWebauthnApi>('/api/plugin/webauthn', { headers })
  }

  private async _refreshToken(tokenId: string) {
    console.log(`[API] Will refresh token ${tokenId}`)
    // Refresh token when refreshToken exists and
    // token's remaining time is less than half of its life time
    const _refreshToken = this.tokens.value[tokenId]?.refreshToken
    if (!_refreshToken) return

    const now = Date.now()
    const current = this.tokens.value[tokenId]
    const remaining = current.decoded.exp * 1000 - now
    const lifetime = (current.decoded.exp - current.decoded.iat) * 1000
    if (remaining > lifetime / 2) return

    console.log(`[API] Refreshing token ${tokenId}`)
    const resp = await this.public.refresh.$post({ json: { refreshToken: _refreshToken } })
    if (resp.ok) {
      const { token, refreshToken } = await resp.json()
      this.tokens.value[tokenId] = {
        token,
        refreshToken,
        decoded: ApiManager.parseJWT(token)
      }
      console.log(`[API] Token ${tokenId} refreshed`)
    } else {
      delete this.tokens.value[tokenId].refreshToken
      console.log(`[API] Failed to refresh token ${tokenId}`)
    }
  }

  private async _updateEffectiveToken(): Promise<void> {
    console.log(`[API] Updating effective token`)
    const tokenIds = Object.keys(this.tokens.value)
    const now = Date.now()
    let bestToken: IClientToken | undefined
    const demandRefreshes: Promise<void>[] = []
    for (const tokenId of tokenIds) {
      const current = this.tokens.value[tokenId]
      if (current.decoded.exp * 1000 < now) {
        if (current.refreshToken) {
          demandRefreshes.push(this._refreshToken(tokenId))
        } else {
          delete this.tokens.value[tokenId]
        }
        continue
      }
      const remaining = current.decoded.exp * 1000 - now
      const lifetime = (current.decoded.exp - current.decoded.iat) * 1000
      if (remaining < lifetime / 2) this._refreshToken(tokenId)

      if (!bestToken || bestToken.decoded.level < current.decoded.level) {
        bestToken = current
      }
    }
    if (!bestToken && demandRefreshes.length) {
      console.log(`[API] Waiting for token refreshes`)
      await Promise.any(demandRefreshes)
      return this._updateEffectiveToken()
    } else {
      console.log(`[API] Effective token updated to ${bestToken?.decoded.jti}`)
      this.effectiveToken.value = bestToken
    }
  }

  async updateEffectiveToken() {
    return navigator.locks.request(`tokens`, async () => {
      await this._updateEffectiveToken()
    })
  }

  async getEffectiveToken() {
    await this.updateEffectiveToken()
    return this.effectiveToken.value
  }

  async dropEffectiveToken() {
    return navigator.locks.request(`tokens`, async () => {
      const effectiveId = this.effectiveToken.value?.decoded.jti
      if (!effectiveId) return
      delete this.tokens.value[effectiveId]
      this._updateEffectiveToken()
    })
  }

  async getHeaders() {
    const headers: Record<string, string> = Object.create(null)
    const token = await this.getEffectiveToken()
    if (token) headers.Authorization = `Bearer ${token.token}`
    return headers
  }

  async login(type: string, payload: unknown) {
    const resp = await this.public.login.$post({ json: { type, payload } })
    const { tokens } = await resp.json()
    for (const { token, refreshToken } of tokens) {
      this.tokens.value[ApiManager.parseJWT(token).jti] = {
        token,
        refreshToken,
        decoded: ApiManager.parseJWT(token)
      }
    }
    await this._updateEffectiveToken()
  }

  async verify(type: string, targetLevel: number, payload: unknown) {
    console.log(`[API] Will verify credential ${type}`)
    const resp = await this.session.elevate.$post({ json: { type, targetLevel, payload } })
    const {
      token: { token, refreshToken }
    } = await resp.json()
    return navigator.locks.request(`tokens`, async () => {
      console.log(`[API] Verifying credential ${type}`)
      this.tokens.value[ApiManager.parseJWT(token).jti] = {
        token,
        refreshToken,
        decoded: ApiManager.parseJWT(token)
      }
      await this._updateEffectiveToken()
    })
  }

  async logout() {
    console.log(`[API] Will logout`)
    return navigator.locks.request(`tokens`, async () => {
      console.log(`[API] Logging out`)
      this.tokens.value = {}
      this.effectiveToken.value = null
    })
  }

  async getSessionClaims(): Promise<IUserClaim[]> {
    const resp = await api.session.claim.$get()
    await this.checkResponse(resp)
    const { claims } = await resp.json()
    this.isAdmin.value = claims.is_admin?.value === 'true'
    return Object.entries(claims).map(([name, claim]) => ({ name, ...claim }))
  }

  async getUserClaims(): Promise<IUserClaim[]> {
    const resp = await api.user.claim.$get()
    const { claims } = await resp.json()
    this.isAdmin.value = claims.is_admin?.value === 'true'
    return Object.entries(claims).map(([name, claim]) => ({ name, ...claim }))
  }

  async getError(resp: Response): Promise<APIErrorType> {
    try {
      const { code, data } = await resp.json()
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

  static parseJWT(token: string) {
    return JSON.parse(atob(token.split('.')[1])) as ITokenPayload
  }
}

export const api = new ApiManager()
