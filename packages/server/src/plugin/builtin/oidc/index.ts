import { type } from 'arktype'
import { definePlugin } from '../../_common.js'
import { oauthRouter } from './oauth.js'

const tOidcConfig = type({
  'issuer?': 'string'
})

type IOidcConfig = typeof tOidcConfig.infer

declare module '../../../index.js' {
  interface IConfig extends IOidcConfig {}
}

export default definePlugin({
  name: 'oidc',
  configType: tOidcConfig,
  setup: async (ctx) => {
    ctx.app.hook('extendApp', (router) => {
      router.route('/', oauthRouter)
    })
  }
})
