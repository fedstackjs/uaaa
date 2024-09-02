import { type } from 'arktype'
import { definePlugin } from '../../_common.js'
import { oauthRouter } from './oauth.js'
import type { ClaimName } from '../../../claim/_common.js'

const tOidcClaimConfig = type({
  alias: 'string',
  'verifiable?': 'boolean'
})
type IOidcClaimConfig = typeof tOidcClaimConfig.infer

const tOidcConfig = type({
  'oidcClaimConfig?': type.Record('string', tOidcClaimConfig),
  'oidcAdditionalClaims?': type.Record('string', 'string')
})

type IOidcConfig = typeof tOidcConfig.infer

declare module '../../../index.js' {
  interface IConfig extends IOidcConfig {}
  interface IClaimDescriptor {
    oidcAlias?: string
    oidcVerifiable?: boolean
  }
}

const defaultConfig: {
  [key in ClaimName]?: IOidcClaimConfig
} = {
  username: { alias: 'preferred_username' },
  realname: { alias: 'name', verifiable: true },
  email: { alias: 'email', verifiable: true },
  phone: { alias: 'phone_number', verifiable: true }
}

export default definePlugin({
  name: 'oidc',
  configType: tOidcConfig,
  setup: async (ctx) => {
    ctx.app.hook('extendApp', (router) => {
      router.route('/', oauthRouter)
    })
    ctx.app.plugin.hook('postSetup', () => {
      const claimConfig = ctx.app.config.get('oidcClaimConfig') ?? defaultConfig
      for (const [claimName, config] of Object.entries(claimConfig)) {
        if (config) {
          ctx.app.claim.registry[claimName as ClaimName].oidcAlias = config.alias
          ctx.app.claim.registry[claimName as ClaimName].oidcVerifiable = config.verifiable ?? false
        }
      }
    })
  }
})
