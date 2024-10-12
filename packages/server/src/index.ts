import { Hookable } from 'hookable'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { ConfigManager, type IConfig } from './config/index.js'
import { DbManager } from './db/index.js'
import { CacheManager } from './cache/index.js'
import { PluginManager } from './plugin/index.js'
import { CredentialManager } from './credential/index.js'
import { TokenManager } from './token/index.js'
import { SessionManager } from './session/index.js'
import { ClaimManager } from './claim/index.js'
import { rootApi } from './api/index.js'
import { logger } from './util/index.js'
import { oauthRouter, oauthWellKnownRouter } from './oauth/index.js'
import { OAuthManager } from './oauth/_common.js'

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
  cache
  credential
  claim
  plugin
  token
  session
  oauth

  private _initialized = false
  private _stopped = false

  constructor(config: IConfig) {
    super()
    this.config = new ConfigManager(this, config)
    this.db = new DbManager(this)
    this.cache = new CacheManager(this)
    this.credential = new CredentialManager(this)
    this.claim = new ClaimManager(this)
    this.plugin = new PluginManager(this)
    this.token = new TokenManager(this)
    this.session = new SessionManager(this)
    this.oauth = new OAuthManager(this)
  }

  async init() {
    if (this._initialized) return
    logger.info(`App initializing...`)
    const start = performance.now()
    await this.plugin.loadPlugins()
    await this.config.validateConfig()
    await this.plugin.setupPlugins()
    await this.db.initDatabase()
    await this.cache.initCache()
    const duration = performance.now() - start
    logger.info(`App initialized in ${duration.toFixed(2)}ms`)
    this._initialized = true
  }

  async stop() {
    if (this._stopped) return
    logger.info(`App stopping...`)
    const start = performance.now()
    await this.db.disconnect()
    const duration = performance.now() - start
    logger.info(`App stopped in ${duration.toFixed(2)}ms`)
    this._stopped = true
  }

  async start() {
    await this.init()

    const app = new Hono()
      .use(async (ctx, next) => {
        ctx.set('app', this)
        await next()
      })
      .route('/api', rootApi)
      .route('/oauth', oauthRouter)
      .route('/.well-known', new Hono().route('/', oauthWellKnownRouter))
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
export * from './claim/index.js'
export * from './db/index.js'
export * from './plugin/index.js'
export * from './token/index.js'
export * from './util/index.js'
