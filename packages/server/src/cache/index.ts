import { Hookable } from 'hookable'
import { CacheImpl } from './_common.js'
import { MongoCache } from './mongo.js'
import type { App } from '../index.js'

export interface CacheManager extends Omit<CacheImpl, 'init'> {}

export class CacheManager extends Hookable {
  impl!: CacheImpl

  constructor(public app: App) {
    super()
  }

  async initCache() {
    this.impl ??= new MongoCache(this)
    await this.impl.init?.()
    this.set = this.impl.set.bind(this.impl)
    this.get = this.impl.get.bind(this.impl)
    this.del = this.impl.del.bind(this.impl)
    this.ttl = this.impl.ttl.bind(this.impl)
    this.setx = this.impl.setx.bind(this.impl)
    this.getx = this.impl.getx.bind(this.impl)
    this.clear = this.impl.clear.bind(this.impl)
  }
}

export * from './_common.js'
export * from './mongo.js'
