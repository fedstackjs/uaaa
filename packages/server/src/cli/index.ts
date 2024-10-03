#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { Command, Option, runExit } from 'clipanion'
import * as t from 'typanion'
import { App } from '../index.js'
import type { Document } from 'mongodb'

abstract class BaseCommand extends Command {
  config = Option.String(`--config`, { env: 'UAAA_SERVER_CONFIG_PATH' })
  private _app?: Promise<App>

  private async _getApp() {
    if (!this.config) throw new Error(`Config path is required`)
    const configText = await readFile(this.config, `utf8`)
    const config = JSON.parse(configText)
    const app = new App(config)
    await app.init()
    return app
  }

  async getApp() {
    return (this._app ??= this._getApp())
  }
}

class ServeCommand extends BaseCommand {
  static paths = [[`serve`], [`s`], Command.Default]

  async execute() {
    const app = await this.getApp()
    await app.start()
  }
}

class FindUserCommand extends BaseCommand {
  static paths = [[`find-user`], [`fu`]]
  userId = Option.String(`-u,--id`, { required: false })
  userName = Option.String(`-n,--username`, { required: false })
  realName = Option.String(`-r,--realname`, { required: false })
  userEmail = Option.String(`-e,--email`, { required: false })
  isAdmin = Option.Boolean(`-a,--admin`, { required: false })
  fields = Option.Array(`-f,--fields`, { required: false })
  pageSize = Option.String(`-s,--size`, '10', { validator: t.isNumber() })
  page = Option.String(`-p,--page`, '1', { validator: t.isNumber() })

  async execute() {
    const app = await this.getApp()
    const filter: Document = {}
    if (this.userId) filter._id = this.userId
    if (this.userName) filter[`claims.username.value`] = this.userName
    if (this.realName) filter[`claims.realname.value`] = this.realName
    if (this.userEmail) filter[`claims.email.value`] = this.userEmail
    if (this.isAdmin) filter[`claims.is_admin.value`] = 'true'
    if (this.fields) {
      if (this.fields.length & 1) throw new Error(`Fields must be in pairs`)
      for (let i = 0; i < this.fields.length; i += 2) {
        const key = this.fields[i]
        const rawValue = this.fields[i + 1]
        const value = rawValue.match(/^[0-9\{\[]/) ? JSON.parse(rawValue) : rawValue
        filter[key] = value
      }
    }
    const skip = this.pageSize * (this.page - 1)
    const limit = this.pageSize
    const count = await app.db.users.countDocuments(filter)
    const items = await app.db.users.find(filter).skip(skip).limit(limit).toArray()
    await app.stop()
    console.group(`Total ${count} users found`)
    for (const item of items) {
      console.group(`User ${item._id}`)
      for (const [k, v] of Object.entries(item.claims)) {
        if (v) {
          console.log(`${k}${v.verified ? ' [verified]' : ''}: ${v.value}`)
        } else {
          console.log(`${k}: [not set]`)
        }
      }
      console.groupEnd()
    }
    console.groupEnd()
    const totalPages = Math.ceil(count / this.pageSize)
    console.log(`Page ${this.page}/${totalPages}`)
  }
}

class UpdateUserCommand extends BaseCommand {
  static paths = [[`update-user`], [`uu`]]
  userId = Option.String(`-u,--id`, { required: true })
  setUserName = Option.String(`-sn,--set-username`)
  setEmail = Option.String(`-se,--set-email`)
  setAdmin = Option.String(`-sa,--set-admin`, { validator: t.isBoolean() })
  setFields = Option.Array(`-sf,--set-fields`)

  async execute() {
    const app = await this.getApp()
    const filter: Document = { _id: this.userId }
    const update: Document = { $set: {}, $unset: {} }
    if (this.setUserName) update.$set[`claims.username.value`] = this.setUserName
    if (this.setEmail) update.$set[`claims.email.value`] = this.setEmail
    if (this.setAdmin !== undefined) {
      if (this.setAdmin) {
        update.$set[`claims.is_admin.value`] = 'true'
      } else {
        update.$unset[`claims.is_admin`] = ''
      }
    }
    if (this.setFields) {
      if (this.setFields.length & 1) throw new Error(`Fields must be in pairs`)
      for (let i = 0; i < this.setFields.length; i += 2) {
        const key = this.setFields[i]
        const rawValue = this.setFields[i + 1]
        const value = rawValue.match(/^[0-9\{\[]/) ? JSON.parse(rawValue) : rawValue
        update.$set[key] = value
      }
    }
    const result = await app.db.users.updateOne(filter, update)
    await app.stop()
    console.log(`Matched ${result.matchedCount} documents`)
    console.log(`Modified ${result.modifiedCount} documents`)
  }
}

class FindCredentialCommand extends BaseCommand {
  static paths = [[`find-credential`], [`fc`]]
  userId = Option.String(`-u,--id`, { required: false })
  credentialId = Option.String(`-c,--credential`, { required: false })
  credentialType = Option.String(`-t,--type`, { required: false })
  userIdentifier = Option.String(`-ui,--user-identifier`, { required: false })
  globalIdentifier = Option.String(`-gi,--global-identifier`, { required: false })
  securityLevel = Option.String(`-sl,--security-level`, {
    required: false,
    validator: t.isNumber()
  })
  fields = Option.Array(`-f,--fields`, { required: false })
  pageSize = Option.String(`-s,--size`, '10', { validator: t.isNumber() })
  page = Option.String(`-p,--page`, '1', { validator: t.isNumber() })

  async execute() {
    const app = await this.getApp()
    const filter: Document = {}
    if (this.userId) filter.userId = this.userId
    if (this.credentialId) filter._id = this.credentialId
    if (this.credentialType) filter.type = this.credentialType
    if (this.userIdentifier) filter.userIdentifier = this.userIdentifier
    if (this.globalIdentifier) filter.globalIdentifier = this.globalIdentifier
    if (this.securityLevel !== undefined) filter.securityLevel = this.securityLevel
    if (this.fields) {
      if (this.fields.length & 1) throw new Error(`Fields must be in pairs`)
      for (let i = 0; i < this.fields.length; i += 2) {
        const key = this.fields[i]
        const rawValue = this.fields[i + 1]
        const value = rawValue.match(/^[0-9\{\[]/) ? JSON.parse(rawValue) : rawValue
        filter[key] = value
      }
    }
    const skip = this.pageSize * (this.page - 1)
    const limit = this.pageSize
    const count = await app.db.credentials.countDocuments(filter)
    const items = await app.db.credentials.find(filter).skip(skip).limit(limit).toArray()
    await app.stop()
    console.group(`Total ${count} credentials found`)
    for (const item of items) {
      console.group(`Credential ${item._id}`)
      console.log(`User ID          : ${item.userId}`)
      console.log(`Type             : ${item.type}`)
      console.log(`User Identifier  : ${item.userIdentifier}`)
      console.log(`Global Identifier: ${item.globalIdentifier}`)
      console.log(`Data             : ${item.data}`)
      console.log(`Remark           : ${item.remark}`)
      console.log(`Security Level   : ${item.securityLevel}`)
      console.groupEnd()
    }
    console.groupEnd()
    const totalPages = Math.ceil(count / this.pageSize)
    console.log(`Page ${this.page}/${totalPages}`)
  }
}

class UpdateCredentialCommand extends BaseCommand {
  static paths = [[`update-credential`], [`uc`]]
  credentialId = Option.String(`-c,--credential`, { required: true })
  setRemark = Option.String(`-sr,--set-remark`)
  setSecurityLevel = Option.String(`-ssl,--set-security-level`, {
    validator: t.cascade(t.isNumber(), [t.isInteger(), t.isInInclusiveRange(0, 4)])
  })

  async execute() {
    const app = await this.getApp()
    const filter: Document = { _id: this.credentialId }
    const update: Document = { $set: {} }
    if (this.setRemark) update.$set.remark = this.setRemark
    if (this.setSecurityLevel !== undefined) update.$set.securityLevel = this.setSecurityLevel
    const result = await app.db.credentials.updateOne(filter, update)
    await app.stop()
    console.log(`Matched ${result.matchedCount} documents`)
    console.log(`Modified ${result.modifiedCount} documents`)
  }
}

runExit([
  ServeCommand,
  FindUserCommand,
  UpdateUserCommand,
  FindCredentialCommand,
  UpdateCredentialCommand
])
