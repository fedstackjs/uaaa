import { type } from 'arktype'
import { Hookable } from 'hookable'
import { rAppId } from '../util/index.js'
import type { App, UAAA } from '../index.js'

const tAppConfig = type({
  appId: type('string').narrow((s): s is UAAA => rAppId.test(s)),
  mongoUri: 'string',
  plugins: 'string[]',
  port: 'number',
  deploymentUrl: type('string').narrow((s) => !s.endsWith('/')),
  jwtTimeout: 'string|string[]',
  refreshTimeout: 'string|string[]',
  tokenTimeout: 'string|string[]',
  'realIpHeader?': 'string',
  'trustedUpstreamIssuers?': 'string[]',
  'openidClaimConfig?': type.Record(
    'string',
    type({
      alias: 'string',
      'verifiable?': 'boolean'
    })
  ),
  'openidAdditionalClaims?': type.Record('string', 'string')
})

type IAppConfig = typeof tAppConfig.infer

export interface IConfig extends IAppConfig {}

export class ConfigManager extends Hookable<{
  validateConfig(config: IConfig): void | Promise<void>
}> {
  constructor(
    public app: App,
    private _config: IConfig
  ) {
    super()
    this.hook('validateConfig', this._validateAppConfig.bind(this))
  }

  async _validateAppConfig() {
    const result = tAppConfig(this._config)
    if (result instanceof type.errors) {
      throw new Error(result.summary, { cause: result })
    }
  }

  async validateConfig() {
    await this.callHook('validateConfig', this._config)
  }

  get<K extends keyof IConfig>(key: K): IConfig[K] {
    return this._config[key]
  }

  getAll() {
    return this._config
  }
}
