import { type } from 'arktype'
import { definePlugin } from '../../_common.js'
import { oauthRouter } from './oauth.js'

const tOidcConfig = type({
  'issuer?': 'string'
})

type IOidcConfig = typeof tOidcConfig.infer

declare module '../../../index.js' {
  interface IConfig extends IOidcConfig {}
  interface IClaimDescriptor {
    oidcAlias?: string
  }
}

export default definePlugin({
  name: 'oidc',
  configType: tOidcConfig,
  setup: async (ctx) => {
    ctx.app.hook('extendApp', (router) => {
      router.route('/', oauthRouter)
    })
    ctx.app.claim.registry['username'].oidcAlias = 'preferred_username'
    ctx.app.claim.registry['realname'].oidcAlias = 'email'
    ctx.app.claim.registry['email'].oidcAlias = 'email'
    ctx.app.claim.registry['phone'].oidcAlias = 'phone_number'
  }
})
