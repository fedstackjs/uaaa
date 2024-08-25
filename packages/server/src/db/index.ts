import { Hookable } from 'hookable'
import type { App } from '../index.js'
import type {
  IAppDoc,
  ICredentialDoc,
  IInstallationDoc,
  IJsonWebKeyPairDoc,
  ISessionDoc,
  ISessionOperationDoc,
  ISystemConfigDoc,
  IUserDoc
} from './model/index.js'
import { MongoClient } from 'mongodb'
import { MigrationManager } from './migration/index.js'

interface ISystemConfig {
  version: number
  migration: boolean
}

export class DbManager extends Hookable {
  mongoClient
  mongoDb

  apps
  installations
  users
  credentials
  sessions
  sessionOperations
  jwkpairs
  system

  private _migration

  constructor(public app: App) {
    super()
    this.mongoClient = new MongoClient(app.config.get('mongoUri'), {})
    this.mongoDb = this.mongoClient.db()

    this.apps = this.mongoDb.collection<IAppDoc>('apps')
    this.installations = this.mongoDb.collection<IInstallationDoc>('installations')
    this.users = this.mongoDb.collection<IUserDoc>('users')
    this.credentials = this.mongoDb.collection<ICredentialDoc>('credentials')
    this.sessions = this.mongoDb.collection<ISessionDoc>('sessions')
    this.sessionOperations = this.mongoDb.collection<ISessionOperationDoc>('sessionOperations')
    this.jwkpairs = this.mongoDb.collection<IJsonWebKeyPairDoc>('jwkpairs')
    this.system = this.mongoDb.collection<ISystemConfigDoc>('system')

    this._migration = new MigrationManager(this)
  }

  async initDatabase() {
    await this._migration.startMigration()
  }

  async getSystemConfig<K extends keyof ISystemConfig>(
    key: K,
    init?: ISystemConfig[K]
  ): Promise<ISystemConfig[K]> {
    const doc = await this.system.findOne({ _id: key })
    if (doc) return doc.value as ISystemConfig[K]
    if (init === undefined) throw new Error(`System config ${key} not found`)
    return init
  }

  async setSystemConfig<K extends keyof ISystemConfig>(
    key: K,
    value: ISystemConfig[K]
  ): Promise<void> {
    await this.system.updateOne({ _id: key }, { $set: { value } }, { upsert: true })
  }

  async delSystemConfig<K extends keyof ISystemConfig>(key: K): Promise<boolean> {
    const { deletedCount } = await this.system.deleteOne({ _id: key })
    return !deletedCount
  }

  async insertSystemConfig<K extends keyof ISystemConfig>(
    key: K,
    value: ISystemConfig[K]
  ): Promise<void> {
    await this.system.insertOne({ _id: key, value })
  }
}

export * from './_common.js'
export * from './model/app.js'
export * from './model/credential.js'
export * from './model/installation.js'
export * from './model/session.js'
export * from './model/user.js'
