import type { ApiManager } from '#imports'
import type { InferResponseType } from 'hono'
import type { LocationQuery } from '#vue-router'

type IAppDTO = InferResponseType<ApiManager['public']['app'][':id']['$get']>['app']

export interface IPreLogoutResult {
  app?: IAppDTO
  trusted?: boolean
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
    return app
  }

  override async preLogout(params: ILogoutParams) {
    const { id_token_hint, client_id } = this._extractParams(params)
    if (id_token_hint) {
      const appId = await this._verifyClient(id_token_hint, client_id)
      if (appId) {
        const app = await this._loadApp(appId)
        return { app, trusted: true }
      }
    }
    if (client_id) {
      try {
        const app = await this._loadApp(client_id)
        return { app, trusted: false }
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
  }

  override async onCancel(
    preLogoutResult: IPreLogoutResult,
    params: ILogoutParams,
    beforeRedirect?: () => void
  ) {
    //
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
