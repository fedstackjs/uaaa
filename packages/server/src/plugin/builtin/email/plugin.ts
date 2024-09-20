import { type } from 'arktype'
import { HTTPException } from 'hono/http-exception'
import { customAlphabet } from 'nanoid'
import mailer from 'nodemailer'
import { logger } from '../../../util/index.js'
import type { App, PluginContext } from '../../../index.js'
import { Hono } from 'hono'
import { EmailImpl } from './credential.js'
import { arktypeValidator } from '@hono/arktype-validator'

export const tEmailConfig = type({
  emailTransport: 'unknown',
  emailFrom: 'string',
  'emailHtml?': 'string|undefined',
  'emailAllowSignup?': 'boolean|undefined',
  'emailWhitelist?': 'string[]|undefined'
})

type IEmailConfig = typeof tEmailConfig.infer

declare module '../../../index.js' {
  interface IConfig extends IEmailConfig {}
  interface ICredentialTypeMap {
    email: string
  }
}

const defaultMailHtml = `
This is a verification email for <b>{{PURPOSE}}</b> and your verification code is <code>{{CODE}}</code>.
`

const codegen = customAlphabet('0123456789', 6)

export class EmailPlugin {
  transporter
  from
  html
  allowSignupFromLogin = false
  whitelist?: Array<string | RegExp>

  constructor(
    public app: App,
    config: IEmailConfig = app.config.getAll()
  ) {
    this.transporter = mailer.createTransport(config.emailTransport as any)
    this.from = config.emailFrom ?? '"UAAA System" <system@uaaa.fedstack.org>'
    this.html = config.emailHtml ?? defaultMailHtml
    this.allowSignupFromLogin = config.emailAllowSignup ?? false
    if (config.emailWhitelist) {
      this.whitelist = []
      for (const item of config.emailWhitelist) {
        if (typeof item !== 'string') throw new Error(`Invalid email whitelist: ${item}`)
        if (item.startsWith('/')) {
          const pattern = item.slice(1, -1)
          this.whitelist.push(new RegExp(pattern))
        } else {
          this.whitelist.push(item)
        }
      }
    }
  }

  async setup(ctx: PluginContext) {
    ctx.app.credential.provide(new EmailImpl(this))
    ctx.app.hook('extendApp', (router) => {
      router.route('/api/plugin/email', this.getApiRouter())
    })
  }

  private checkWhitelist(mail: string): boolean {
    if (!this.whitelist) return true
    const domain = mail.split('@')[1]
    for (const item of this.whitelist) {
      if (typeof item === 'string') {
        if (item === domain) return true
      } else {
        if (item.test(mail)) return true
      }
    }
    return false
  }

  mailKey(mail: string): string {
    return `mailcode:${btoa(mail)}`
  }

  private async sendCode(key: string, mail: string, purpose: string) {
    if (!this.checkWhitelist(mail)) throw new HTTPException(403, { message: 'Email not allowed' })
    const ttl = await this.app.cache.ttl(key)
    if (ttl > 0) {
      throw new HTTPException(429, { message: `Wait for ${Math.ceil(ttl / 1000)} seconds` })
    }
    const code = codegen()
    await this.app.cache.setx(key, { code, mail, n: 5 }, 5 * 60 * 1000)
    const info = await this.transporter.sendMail({
      from: this.from,
      to: mail,
      subject: 'Verification code',
      html: this.html.replace('{{PURPOSE}}', purpose).replace('{{CODE}}', code)
    })
    logger.info(info, `sent verification code to ${mail} for ${purpose}`)
  }

  async checkCode(key: string, code: string) {
    const ttl = await this.app.cache.ttl(key)
    const value = await this.app.cache.getx<{ code: string; mail: string; n: number }>(key)
    await this.app.cache.del(key)
    if (!value) throw new HTTPException(403, { message: 'Invalid code' })
    if (value.code !== code) {
      if (ttl > 0 && value.n > 0) {
        await this.app.cache.setx(key, { ...value, n: value.n - 1 }, ttl)
      }
      throw new HTTPException(403, { message: 'Invalid code' })
    }
    return value
  }

  getApiRouter() {
    return new Hono().post(
      '/send',
      arktypeValidator(
        'json',
        type({
          email: 'string.email'
        })
      ),
      async (ctx) => {
        const { email } = ctx.req.valid('json')
        if (!this.checkWhitelist(email)) {
          throw new HTTPException(403, { message: 'Email not allowed' })
        }
        await this.sendCode(this.mailKey(email), email, 'verification')
        return ctx.json({})
      }
    )
  }
}
