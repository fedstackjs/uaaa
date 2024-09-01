import { definePlugin } from '../../_common.js'
import { WebauthnPlugin } from './plugin.js'

export type IWebauthnApi = ReturnType<WebauthnPlugin['getApiRouter']>

export default definePlugin({
  name: 'webauthn',
  configType: WebauthnPlugin.tConfig,
  setup: async (ctx) => {
    const plugin = new WebauthnPlugin(ctx.app)
    await plugin.setup(ctx)
  }
})
