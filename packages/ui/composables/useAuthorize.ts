import type { ApiManager } from '#imports'
import type { LocationQueryValue } from '#vue-router'
import type { InferResponseType } from 'hono'

const toSingle = (value: LocationQueryValue | LocationQueryValue[], init: string): string =>
  (Array.isArray(value) ? value[0] : value) ?? init
const toArray = (value: LocationQueryValue | LocationQueryValue[]): string[] =>
  value === null ? [] : Array.isArray(value) ? value.filter((v) => v !== null) : [value]
type IAppDTO = InferResponseType<ApiManager['public']['app'][':id']['$get']>['app']

abstract class Connector {
  abstract preAuthorize(params: IAuthorizeParams, app: IAppDTO): Promise<void>
  abstract onAuthorize(params: IAuthorizeParams, app: IAppDTO): Promise<void>
  abstract onCancel(params: IAuthorizeParams, app: IAppDTO): Promise<void>
}

class OpenIDConnector extends Connector {
  private _extractParams(params: IAuthorizeParams) {
    const response_type = params.params?.response_type as string
    if (!response_type) throw new Error('Missing response_type')
    const redirect_uri = params.params?.redirect_uri as string
    if (!redirect_uri) throw new Error('Missing redirect_uri')
    const state = params.params?.state as string
    const code_challenge = params.params?.code_challenge as string
    const code_challenge_method = params.params?.code_challenge_method as string
    const nonce = params.params?.nonce as string
    return { response_type, redirect_uri, state, code_challenge, code_challenge_method, nonce }
  }

  override async preAuthorize(params: IAuthorizeParams, app: IAppDTO): Promise<void> {
    const { response_type, redirect_uri } = this._extractParams(params)
    if (response_type !== 'code') throw new Error('Invalid response_type')

    const resp = await api.public.app[':id'].check_redirect.$post({
      param: { id: app._id },
      json: { url: redirect_uri }
    })
    await api.checkResponse(resp)
  }

  override async onAuthorize(params: IAuthorizeParams, app: IAppDTO): Promise<void> {
    const { redirect_uri, state, code_challenge, code_challenge_method, nonce } =
      this._extractParams(params)
    const challenge = code_challenge && `${code_challenge_method ?? 'plain'}:${code_challenge}`
    const resp = await api.session.derive.$post({
      json: {
        clientAppId: params.clientAppId,
        securityLevel: params.securityLevel,
        nonce,
        challenge
      }
    })
    await api.checkResponse(resp)
    const data = await resp.json()
    if (!('code' in data)) {
      throw new Error('Invalid response')
    }
    const redirectParams = new URLSearchParams({
      code: data.code,
      state
    })
    const url = redirect_uri + '?' + redirectParams.toString()
    location.href = url
  }

  override async onCancel(params: IAuthorizeParams, app: IAppDTO): Promise<void> {
    const redirectParams = new URLSearchParams({
      error: 'access_denied'
    })
    const url = params.params.redirect_uri + '?' + redirectParams.toString()
    location.href = url
  }
}

const connectors = {
  oidc: new OpenIDConnector()
} satisfies Record<string, Connector>

type ConnectorType = keyof typeof connectors
const isConnectorType = (value: string): value is ConnectorType => value in connectors

export interface IAuthorizeParams {
  type: ConnectorType
  connector: Connector
  clientAppId: string
  securityLevel: number
  permissions?: string[]
  optionalPermissions?: string[]
  params?: any
}

export const useAuthorize = () => {
  const route = useRoute()
  const params = computed<IAuthorizeParams | { error: string }>(() => {
    const type = toSingle(route.query.type, 'oidc')
    if (!isConnectorType(type)) return { error: `Invalid connector type: ${type}` }
    const clientAppId = toSingle(route.query.clientAppId, '')
    if (!clientAppId) return { error: 'Missing clientAppId' }
    const connector = connectors[type]
    const securityLevel = +toSingle(route.query.securityLevel, '0')
    if (!Number.isInteger(securityLevel) || securityLevel < 0 || securityLevel > 4) {
      return { error: `Invalid security level: ${securityLevel}` }
    }
    const params: IAuthorizeParams = {
      type,
      connector,
      clientAppId,
      securityLevel
    }
    if (route.query.permissions) {
      params.permissions = toArray(route.query.permissions)
    }
    if (route.query.optionalPermissions) {
      params.optionalPermissions = toArray(route.query.optionalPermissions)
    }
    const connectorParams = toSingle(route.query.params, '{}')
    try {
      params.params = JSON.parse(connectorParams)
    } catch (err) {
      return { error: `Invalid params` }
    }
    return params
  })
  return { params }
}
