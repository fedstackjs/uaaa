import type { ApiManager } from '#imports'
import type { InferResponseType } from 'hono'

type IAppDTO = InferResponseType<ApiManager['public']['app'][':id']['$get']>['app']

export abstract class Connector {
  clientAppId
  type
  params
  securityLevel
  error: unknown

  constructor() {
    const route = useRoute()
    this.clientAppId = route.query.clientAppId as string
    this.type = route.query.type as string
    this.securityLevel = parseInt(`${route.query.securityLevel}`)
    this.params = JSON.parse(route.query.params as string)
  }
  abstract checkAuthorize(app: IAppDTO): Promise<void> | void
  abstract onAuthorize(app: IAppDTO, tokenId: string): Promise<void> | void
  abstract onCancel(app: IAppDTO): Promise<void> | void
}

export class OpenIDConnector extends Connector {
  response_type
  redirect_uri
  state

  constructor() {
    super()
    this.response_type = this.params.response_type
    this.redirect_uri = this.params.redirect_uri
    this.state = this.params.state
  }

  async checkRedirect(app: IAppDTO, redirect: string) {
    const resp = await api.public.app[':id'].check_redirect.$post({
      param: { id: app._id },
      json: { url: redirect }
    })
    await api.checkResponse(resp)
  }

  override async checkAuthorize(app: IAppDTO) {
    if (this.response_type !== 'code') {
      throw new Error('Invalid response_type')
    }
    await this.checkRedirect(app, this.redirect_uri)
  }

  override onAuthorize(app: IAppDTO, tokenId: string): void {
    const params = new URLSearchParams({
      code: tokenId,
      state: this.state
    })
    const url = this.redirect_uri + '?' + params.toString()
    location.href = url
  }

  override onCancel(): void {
    const params = new URLSearchParams({
      error: 'access_denied'
    })
    const url = this.redirect_uri + '?' + params.toString()
    location.href = url
  }
}
