#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { Command, Option, runExit } from 'clipanion'
import { App } from '../index.js'

class ServeCommand extends Command {
  static paths = [[`serve`], [`s`], Command.Default]
  config = Option.String(`--config`, { required: true })

  async execute() {
    const configText = await readFile(this.config, `utf8`)
    const config = JSON.parse(configText)
    const app = new App(config)
    await app.start()
  }
}

runExit([ServeCommand])
