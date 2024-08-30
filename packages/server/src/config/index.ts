import { ArkErrors, type } from 'arktype'
import { Hookable } from 'hookable'
import type { App } from '../index.js'

const tAppConfig = type({
  mongoUri: 'string',
  plugins: 'string[]',
  port: 'number',
  deploymentUrl: 'string',
  sessionTimeout: 'string',
  tokenTimeout: 'string',
  refreshTimeout: 'string',
  defaultUserSecurityLevel: 'number'
})

type IAppConfig = typeof tAppConfig.infer

export interface IConfig extends IAppConfig {}

export class ConfigManager extends Hookable<{
  validateConfig(config: IConfig): void | Promise<void>
}> {
  constructor(public app: App, private _config: IConfig) {
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
