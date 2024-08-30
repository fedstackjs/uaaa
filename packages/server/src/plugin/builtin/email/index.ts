import { definePlugin } from '../../_common.js'
import { EmailPlugin, tEmailConfig } from './plugin.js'

export type IEmailApi = ReturnType<EmailPlugin['getApiRouter']>

export default definePlugin({
  name: 'email',
  configType: tEmailConfig,
  setup: async (ctx) => {
    const plugin = new EmailPlugin(ctx.app)
    await plugin.setup(ctx)
  }
})
