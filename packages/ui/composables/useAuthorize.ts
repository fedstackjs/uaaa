import type { ApiManager } from '#imports'
import type { LocationQuery, LocationQueryValue } from '#vue-router'
import type { InferResponseType } from 'hono'
import { renderSVG } from 'uqr'
import type { SecurityLevel } from '~/utils/api'

const toSingle = (value: LocationQueryValue | LocationQueryValue[], init: string): string =>
  (Array.isArray(value) ? value[0] : value) ?? init
const toArray = (value: LocationQueryValue | LocationQueryValue[]): string[] =>
  value === null ? [] : Array.isArray(value) ? value.filter((v) => v !== null) : [value]
type IAppDTO = InferResponseType<ApiManager['public']['app'][':id']['$get']>['app']

abstract class Connector {
  abstract preAuthorize(params: IAuthorizeParams, app: IAppDTO): Promise<void>
  abstract onAuthorize(params: IAuthorizeParams, app: IAppDTO): Promise<void>
  abstract onRemoteAuthorize(
    params: IAuthorizeParams,
    response: Record<string, unknown>
  ): Promise<void>
  abstract onCancel(params: IAuthorizeParams, app: IAppDTO): Promise<void>
}

class OpenIDConnector extends Connector {
  private _extractParams(params: IAuthorizeParams) {
    const response_type = params.params?.response_type as string
    const redirect_uri = params.params?.redirect_uri as string
    if (!params.userCode) {
      if (!response_type) throw new Error('Missing response_type')
      if (!redirect_uri) throw new Error('Missing redirect_uri')
    }
    const state = params.params?.state as string
    const code_challenge = params.params?.code_challenge as string
    const code_challenge_method = params.params?.code_challenge_method as string
    const nonce = params.params?.nonce as string
    return { response_type, redirect_uri, state, code_challenge, code_challenge_method, nonce }
  }

  override async preAuthorize(params: IAuthorizeParams, app: IAppDTO): Promise<void> {
    const { response_type, redirect_uri } = this._extractParams(params)
    if (!params.userCode) {
      if (response_type !== 'code') throw new Error('Invalid response_type')
      const resp = await api.public.app[':id'].check_redirect.$post({
        param: { id: app._id },
        json: { url: redirect_uri }
      })
      await api.checkResponse(resp)
    }
  }

  override async onAuthorize(params: IAuthorizeParams, app: IAppDTO): Promise<void> {
    const { redirect_uri, state, code_challenge, code_challenge_method, nonce } =
      this._extractParams(params)
    const challenge = code_challenge && `${code_challenge_method ?? 'plain'}:${code_challenge}`
    const resp = await api.session.derive.$post({
      json: {
        clientAppId: params.clientAppId,
        securityLevel: params.securityLevel,
        permissions: params.permissions,
        optionalPermissions: params.optionalPermissions,
        nonce,
        challenge,
        confidential: params.confidential,
        remote: !!params.userCode
      }
    })
    await api.checkResponse(resp)
    const data = await resp.json()
    if (!('code' in data)) {
      throw new Error('Invalid response')
    }
    if (params.userCode) {
      const resp = await api.session.remote_authorize.$post({
        json: {
          userCode: params.userCode,
          response: {
            code: data.code,
            state
          }
        }
      })
      await api.checkResponse(resp)
    } else {
      const redirectParams = new URLSearchParams({
        code: data.code,
        state
      })
      const url = redirect_uri + '?' + redirectParams.toString()
      location.href = url
    }
  }

  override async onRemoteAuthorize(
    params: IAuthorizeParams,
    response: Record<string, unknown>
  ): Promise<void> {
    const { redirect_uri } = this._extractParams(params)
    if (!('code' in response) || typeof response.code !== 'string') {
      throw new Error('Invalid response')
    }
    const redirectParams = new URLSearchParams({
      code: response.code,
      state: response.state as string
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
  securityLevel: SecurityLevel
  permissions?: string[]
  optionalPermissions?: string[]
  params?: any
  userCode?: string
  confidential?: boolean
}

const parseAuthorizeParams = (query: LocationQuery) => {
  const type = toSingle(query.type, 'oidc')
  if (!isConnectorType(type)) return { error: `Invalid connector type: ${type}` }
  const clientAppId = toSingle(query.clientAppId, '')
  if (!clientAppId) return { error: 'Missing clientAppId' }
  const connector = connectors[type]
  const securityLevel = +toSingle(query.securityLevel, '0')
  if (!Number.isInteger(securityLevel) || securityLevel < 0 || securityLevel > 4) {
    return { error: `Invalid security level: ${securityLevel}` }
  }
  const userCode = toSingle(query.userCode, '')
  const params: IAuthorizeParams = {
    type,
    connector,
    clientAppId,
    securityLevel: securityLevel as SecurityLevel,
    userCode
  }
  params.confidential = ['1', 'true'].includes(toSingle(query.confidential, '1'))
  try {
    params.params = JSON.parse(toSingle(query.params, '{}'))
    if (query.permissions) {
      params.permissions = JSON.parse(toSingle(query.permissions, '[]'))
    }
    if (query.optionalPermissions) {
      params.optionalPermissions = JSON.parse(toSingle(query.optionalPermissions, '[]'))
    }
  } catch (err) {
    return { error: `Invalid params` }
  }
  return params
}

export const useAuthorize = () => {
  const route = useRoute()
  const params = computed<IAuthorizeParams | { error: string }>(() =>
    parseAuthorizeParams(route.query)
  )
  return { params }
}

export const useRemoteAuthorize = () => {
  const route = useRoute()
  const router = useRouter()
  const showRemote = computed(() => {
    if (typeof route.query.redirect !== 'string') return false
    return router.resolve(route.query.redirect).path === '/authorize'
  })
  const isRemote = ref(false)
  const userCodeRef = ref('')
  const qrcode = ref('')
  const scanned = ref(false)
  const { run: startRemoteAuthorize, running: remoteAuthorizeRunning } = useTask(async () => {
    if (typeof route.query.redirect !== 'string') throw new Error('Invalid redirect')
    if (isRemote.value) return symNoToast

    isRemote.value = true
    scanned.value = false
    const target = router.resolve(route.query.redirect)
    const params = parseAuthorizeParams(target.query)
    if ('error' in params) {
      throw new Error(params.error)
    }
    const resp = await api.public.remote_authorize.$post()
    await api.checkResponse(resp)
    const { authCode, userCode } = await resp.json()
    userCodeRef.value = userCode
    const remoteUrl = new URL('/remote', location.href)
    remoteUrl.searchParams.set('user_code', userCode)
    const svg = renderSVG(remoteUrl.toString())
    qrcode.value = `data:image/svg+xml,${encodeURIComponent(svg)}`
    for (;;) {
      const resp = await api.public.remote_authorize_poll.$post({
        json: { userCode, authCode, request: target.query as any }
      })
      await api.checkResponse(resp)
      const { response } = await resp.json()
      if (response) {
        params.connector.onRemoteAuthorize(params, response)
        break
      } else if (response === null) {
        scanned.value = true
      }
      await sleep(5000)
    }
  })
  return {
    showRemote,
    isRemote,
    userCode: userCodeRef,
    qrcode,
    scanned,
    startRemoteAuthorize,
    remoteAuthorizeRunning
  }
}

export const useRemoteAuthorizeUser = () => {
  const route = useRoute()
  const router = useRouter()
  const userCodeRef = ref(toSingle(route.query.user_code, ''))
  const canAuthorize = computed(() => /^[\w]{4}-[\w]{4}$/.test(userCodeRef.value))
  const connected = ref(false)
  const requestRef = ref<Record<string, unknown> | null>(null)
  const userCodeRules = [(value: string) => /^[\w]{4}-[\w]{4}$/.test(value) || 'Invalid user code']
  const { run: startRemoteAuthorize, running: remoteAuthorizeRunning } = useTask(async () => {
    if (!/^[\w-]{9}$/.test(userCodeRef.value)) throw new Error('Invalid user code')
    const userCode = userCodeRef.value.toUpperCase()
    const resp = await api.session.remote_authorize_activate.$post({ json: { userCode } })
    await api.checkResponse(resp)
    for (;;) {
      const resp = await api.session.remote_authorize_poll.$post({ json: { userCode } })
      await api.checkResponse(resp)
      const { request } = await resp.json()
      if (request) {
        connected.value = true
        requestRef.value = request
        break
      }
      await sleep(1000)
    }
  })
  const doRemoteAuthorize = () => {
    router.replace({
      path: '/authorize',
      query: {
        ...requestRef.value,
        userCode: userCodeRef.value
      }
    })
  }
  const cancelRemoteAuthorize = async () => {
    await api.session.remote_authorize.$post({
      json: { userCode: userCodeRef.value, response: { error: 'User canceled' } }
    })
    router.replace('/')
  }
  return {
    userCode: userCodeRef,
    canAuthorize,
    connected,
    request: requestRef,
    startRemoteAuthorize,
    remoteAuthorizeRunning,
    userCodeRules,
    doRemoteAuthorize,
    cancelRemoteAuthorize
  }
}
