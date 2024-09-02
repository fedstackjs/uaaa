import { Type, type } from 'arktype'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { logger } from '../util/index.js'
import { Hookable } from 'hookable'
import type { App } from '../index.js'

const tPluginMetadata = type({
  name: 'string',
  'version?': 'string',
  'description?': 'string',
  'license?': 'string',
  'author?': 'string'
})

export type IPluginMetadata = typeof tPluginMetadata.infer

export interface IPluginSetupFn {
  (ctx: PluginContext): void | Promise<void>
}

export interface IPlugin extends IPluginMetadata {
  setup: IPluginSetupFn
  configType?: Type
}

export interface ILoadedPlugin extends IPluginMetadata {
  setup: IPluginSetupFn
  setupPromise?: Promise<void>
}

export class PluginContext {
  app

  constructor(
    public manager: PluginManager,
    public metadata: IPluginMetadata
  ) {
    this.app = manager.app
  }
}

export class PluginManager extends Hookable<{
  postSetup(): void | Promise<void>
}> {
  private _resolver: NodeRequire
  plugins: Record<string, ILoadedPlugin> = Object.create(null)

  constructor(public app: App) {
    super()
    this._resolver = createRequire(import.meta.url)
  }

  private async _addPlugin({ configType, ...plugin }: IPlugin) {
    this.plugins[plugin.name] = plugin
    if (configType) {
      this.app.config.hook('validateConfig', (config) => {
        const result = configType(config)
        if (result instanceof type.errors) {
          throw new Error(result.summary, { cause: result })
        }
      })
    }
  }

  private async _loadPlugin(name: string) {
    let setup: IPluginSetupFn
    let metadata: IPluginMetadata
    try {
      const packageJsonPath = this._resolver.resolve(`${name}/package.json`)
      const json = await readFile(packageJsonPath, 'utf-8')
      metadata = JSON.parse(json)
    } catch {}
    metadata ??= { name }
    const { default: plugin } = await import(name)
    if (typeof plugin === 'function') {
      setup = plugin
    } else {
      setup = plugin.setup
      metadata = { ...metadata, ...plugin }
    }
    const pluginMetadata = tPluginMetadata(metadata)
    if (pluginMetadata instanceof type.errors) {
      throw new Error(pluginMetadata.summary)
    }
    this._addPlugin({ ...metadata, setup })
    logger.info(`Loaded plugin: ${metadata.name}`)
  }

  async resolvePlugin(name: string) {
    logger.info(`Resolving plugin: ${name}`)
    const names = [name, `@uaaa/plugin-${name}`, `./builtin/${name}/index.js`]
    for (const name of names) {
      try {
        const path = this._resolver.resolve(name)
        logger.info(`Resolving plugin: ${name} => ${path}`)
        return name
      } catch {}
    }
    throw new Error(`Cannot resolve plugin: ${name}`)
  }

  async loadPlugin(name: string) {
    logger.info(`Loading plugin: ${name}`)
    try {
      await this._loadPlugin(await this.resolvePlugin(name))
    } catch (err) {
      throw new Error(`Failed to load plugin ${name}`, { cause: err })
    }
  }

  async loadPlugins(names = this.app.config.get('plugins')) {
    for (const name of names) {
      await this.loadPlugin(name)
    }
  }

  async setupPlugins() {
    for (const plugin of Object.values(this.plugins)) {
      plugin.setupPromise = Promise.resolve(plugin.setup(new PluginContext(this, plugin)))
    }
    await Promise.all(Object.values(this.plugins).map((plugin) => plugin.setupPromise))
    await this.callHook('postSetup')
  }

  async waitForPlugin(name: string, fail = true) {
    if (fail && !Object.hasOwn(this.plugins, name)) {
      throw new Error(`Plugin ${name} not found`)
    }
    await this.plugins[name].setupPromise
  }
}

export function definePlugin(plugin: IPluginSetupFn | IPlugin) {
  return plugin
}
