import { generateKeyPair } from 'node:crypto'
import { promisify } from 'node:util'
import { Hookable } from 'hookable'
import { MongoServerError } from 'mongodb'
import type { DbManager } from '../index.js'
import { logger, wait } from '../../util/index.js'

export const databaseVersion = 1

export class MigrationManager extends Hookable {
  constructor(public db: DbManager) {
    super()
  }

  private async _initDb() {
    // Create indexes
    await this.db.installations.createIndex({ userId: 1, appId: 1 }, { unique: true })
    await this.db.tokens.createIndex(
      { refreshToken: 1 },
      { unique: true, partialFilterExpression: { refreshToken: { $exists: true } } }
    )

    const { privateKey, publicKey } = await promisify(generateKeyPair)('rsa', {
      modulusLength: 2048
    })
    await this.db.jwkpairs.insertOne({
      publicKey: publicKey.export({ format: 'jwk' }),
      privateKey: privateKey.export({ format: 'jwk' })
    })
    await this.db.setSystemConfig('version', databaseVersion)
  }

  private async _startMigration() {
    await this._initDb()
  }

  async startMigration() {
    for (;;) {
      if (databaseVersion === (await this.db.getSystemConfig('version', 0))) break
      try {
        await this.db.insertSystemConfig('migration', true)
        logger.info('Starting database migration')
        await this._startMigration()
        await this.db.delSystemConfig('migration')
      } catch (e) {
        if (e instanceof MongoServerError && e.code === 11000) {
          logger.info('Waiting for database migration')
          await wait(100)
        } else {
          throw e
        }
      }
    }
  }
}
