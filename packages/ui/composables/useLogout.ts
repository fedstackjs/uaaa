import type { ApiManager } from '#imports'
import type { InferResponseType } from 'hono'
import type { LocationQuery } from '#vue-router'

type IAppDTO = InferResponseType<ApiManager['public']['app'][':id']['$get']>['app']

export interface IPreLogoutResult {
  app?: IAppDTO
  trusted?: boolean
  redirect?: string
}

abstract class LogoutConnector {
  abstract preLogout(params: ILogoutParams): Promise<IPreLogoutResult>
  abstract onLogout(
    preLogoutResult: IPreLogoutResult,
    params: ILogoutParams,
    beforeRedirect?: () => void
  ): Promise<void>
  abstract onCancel(
    preLogoutResult: IPreLogoutResult,
    params: ILogoutParams,
    beforeRedirect?: () => void
  ): Promise<void>
}

class OpenIDLogoutConnector extends LogoutConnector {
  private _extractParams(params: ILogoutParams) {
    const obj: Record<string, string | undefined> =
      typeof params.params === 'object' ? params.params : {}
    const { id_token_hint, logout_hint, client_id, post_logout_redirect_uri, state } = obj
    return { id_token_hint, logout_hint, client_id, post_logout_redirect_uri, state }
  }

  private async _verifyClient(id_token_hint: string, client_id?: string) {
    const resp = await api.session.validate_token.$post({
      json: {
        token: id_token_hint,
        appId: client_id,
        ignoreExpiration: true
      }
    })
    await api.checkResponse(resp)
    const { appId } = await resp.json()
    return appId
  }

  private async _loadApp(appId: string) {
    const resp = await api.public.app[':id'].$get({
      param: { id: appId }
    })
    await api.checkResponse(resp)
    const { app } = await resp.json()
    return { app }
  }

  private async _loadRedirect(appId: string, redirect?: string) {
    if (!redirect) return { redirect: undefined }
    try {
      const resp = await api.public.app[':id'].check_redirect.$post({
        param: { id: appId },
        json: { url: redirect, type: 'logout' }
      })
      await api.checkResponse(resp)
      return { redirect }
    } catch {
      return { redirect: undefined }
    }
  }

  override async preLogout(params: ILogoutParams) {
    const { id_token_hint, client_id, post_logout_redirect_uri } = this._extractParams(params)
    if (id_token_hint) {
      const appId = await this._verifyClient(id_token_hint, client_id)
      if (appId) {
        return {
          ...(await this._loadApp(appId)),
          ...(await this._loadRedirect(appId, post_logout_redirect_uri)),
          trusted: true
        }
      }
    }
    if (client_id) {
      try {
        return {
          ...(await this._loadApp(client_id)),
          ...(await this._loadRedirect(client_id, post_logout_redirect_uri)),
          trusted: false
        }
      } finally {
      }
    }
    return {}
  }

  override async onLogout(
    preLogoutResult: IPreLogoutResult,
    params: ILogoutParams,
    beforeRedirect?: () => void
  ) {
    await api.logout()
    if (preLogoutResult.redirect) {
      beforeRedirect?.()
      window.location.href = preLogoutResult.redirect
    }
  }

  override async onCancel(
    preLogoutResult: IPreLogoutResult,
    params: ILogoutParams,
    beforeRedirect?: () => void
  ) {
    if (preLogoutResult.redirect) {
      beforeRedirect?.()
      window.location.href = preLogoutResult.redirect
    }
  }
}

const connectors = {
  oidc: new OpenIDLogoutConnector()
} satisfies Record<string, LogoutConnector>

type ConnectorType = keyof typeof connectors
const isConnectorType = (value: string): value is ConnectorType => value in connectors

export interface ILogoutParams {
  type: ConnectorType
  connector: LogoutConnector
  params?: any
}

export const parseLogoutParams = (query: LocationQuery) => {
  const type = toSingle(query.type, 'oidc')
  if (!isConnectorType(type)) return { error: `Invalid connector type: ${type}` }
  const connector = connectors[type]
  const params: ILogoutParams = {
    type,
    connector
  }
  try {
    params.params = JSON.parse(toSingle(query.params, '{}'))
  } catch (err) {
    return { error: `Invalid params` }
  }
  return params
}

export const useLogout = () => {
  const route = useRoute()
  const params = computed<ILogoutParams | { error: string }>(() => {
    const params = parseLogoutParams(route.query)
    return params
  })
  return { params }
}
