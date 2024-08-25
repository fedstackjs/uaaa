#!/usr/bin/env node
import { Command, Option, runExit } from 'clipanion'
import * as t from 'typanion'
import { App } from '../index.js'

class ServeCommand extends Command {
  static paths = [[`serve`], [`s`], Command.Default]
  port = Option.String('--port', '3030', {
    validator: t.cascade(t.isNumber(), [t.isInteger(), t.isInInclusiveRange(1, 65535)])
  })
  mongoUri = Option.String('--mongo-uri', 'mongodb://localhost:27017/uaaa')
  plugins = Option.Array('--plugin', ['password', 'oidc'])
  sessionTimeout = Option.String('--session-timeout', '7d')
  deploymentUrl = Option.String('--deployment-url', 'http://localhost:3030')
  tokenTimeout = Option.String('--token-timeout', '15m')
  refreshTimeout = Option.String('--refresh-timeout', '7d')

  async execute() {
    const app = new App(this)
    await app.start()
  }
}

runExit([ServeCommand])
