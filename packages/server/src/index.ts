import { Hookable } from 'hookable'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { ConfigManager, IConfig } from './config/index.js'
import { DbManager } from './db/index.js'
import { PluginManager } from './plugin/index.js'
import { rootApi } from './api/index.js'
import { logger } from './util/index.js'
import { CredentialManager } from './credential/index.js'
import { TokenManager } from './util/index.js'

declare module 'hono' {
  interface ContextVariableMap {
    app: App
  }
}

export class App extends Hookable<{
  extendApp(router: Hono): void | Promise<void>
}> {
  config
  db
  credential
  plugin
  token

  constructor(config: IConfig) {
    super()
    this.config = new ConfigManager(this, config)
    this.db = new DbManager(this)
    this.credential = new CredentialManager(this)
    this.plugin = new PluginManager(this)
    this.token = new TokenManager(this)
  }

  async start() {
    await this.plugin.loadPlugins()
    await this.config.validateConfig()
    await this.plugin.setupPlugins()
    await this.db.initDatabase()

    const app = new Hono()
      .use(async (ctx, next) => {
        ctx.set('app', this)
        await next()
      })
      .route('/api', rootApi)
    await this.callHook('extendApp', app)
    serve({
      fetch: app.fetch,
      port: this.config.get('port')
    })
    logger.info(`Server listening on port ${this.config.get('port')}`)
  }
}

export * from './api/index.js'
export * from './config/index.js'
export * from './credential/index.js'
export * from './db/index.js'
export * from './plugin/index.js'
export * from './util/index.js'
