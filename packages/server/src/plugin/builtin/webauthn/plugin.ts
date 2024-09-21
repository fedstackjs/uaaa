import { type } from 'arktype'
import {
  logger,
  SecurityLevel,
  verifyAuthorizationJwt,
  verifyPermission,
  type App,
  type PluginContext
} from '../../../index.js'
import { IWebauthnKey, WebauthnImpl } from './credential.js'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import ms from 'ms'
import { generateAuthenticationOptions, generateRegistrationOptions } from '@simplewebauthn/server'
import { arktypeValidator } from '@hono/arktype-validator'

type IWebauthnConfigConfig = typeof WebauthnPlugin.tConfig.infer

declare module '../../../index.js' {
  interface IConfig extends IWebauthnConfigConfig {}
  interface ICredentialTypeMap {
    webauthn: string
  }
}

export class WebauthnPlugin {
  static tConfig = type({
    'webauthnRpName?': 'string',
    'webauthnRpId?': 'string',
    'webauthnOrigin?': 'string'
  })

  rpName: string
  rpId: string
  origin: string

  constructor(
    public app: App,
    config: IWebauthnConfigConfig = app.config.getAll()
  ) {
    this.rpName = config.webauthnRpName ?? 'Unified Authentication and Authorization System'
    this.rpId = config.webauthnRpId ?? new URL(this.app.config.get('deploymentUrl')).hostname
    this.origin = config.webauthnOrigin ?? app.config.get('deploymentUrl')
  }

  async setup(ctx: PluginContext) {
    if (!this.rpId) {
      logger.warn('WebauthnPlugin: rpId is set to empty which is a bad SecOp!')
    }
    if (!this.origin) {
      logger.warn('WebauthnPlugin: origin is set to empty which is a bad SecOp!')
    }
    ctx.app.credential.provide(new WebauthnImpl(this))
    ctx.app.hook('extendApp', (router) => {
      router.route('/api/plugin/webauthn', this.getApiRouter())
    })
  }

  getCacheKey(action: 'bind' | 'verify', userId: string) {
    return `webauthn-${action}-${userId}`
  }

  getApiRouter() {
    return (
      new Hono()
        // Register
        .post(
          '/bind',
          verifyAuthorizationJwt,
          verifyPermission({ securityLevel: SecurityLevel.SL1 }),
          arktypeValidator(
            'json',
            type({
              'local?': 'boolean',
              'userVerification?': 'boolean'
            })
          ),
          async (ctx) => {
            const { local, userVerification } = ctx.req.valid('json')
            const { app, token } = ctx.var
            const user = await app.db.users.findOne({ _id: token.sub })
            if (!user) throw new HTTPException(404)
            const credentials = await app.db.credentials
              .find({ userId: user._id, type: 'webauthn' })
              .toArray()
            const { hostname } = new URL(ctx.req.url)

            const options: any = await generateRegistrationOptions({
              rpName: this.rpName,
              rpID: this.rpId || hostname,
              userName: user.claims.username.value,
              attestationType: 'none',
              excludeCredentials: credentials.map(({ secret }) => ({
                id: (secret as IWebauthnKey).id
              })),
              authenticatorSelection: {
                residentKey: local ? 'required' : 'preferred',
                userVerification: userVerification ? 'required' : 'preferred',
                authenticatorAttachment: local ? 'platform' : 'cross-platform'
              }
            })
            await app.cache.setx(this.getCacheKey('bind', user._id), options, ms('5min'))
            return ctx.json({ options })
          }
        )
        // Verify
        .post(
          '/verify',
          verifyAuthorizationJwt,
          arktypeValidator(
            'json',
            type({
              'userVerification?': 'boolean'
            })
          ),
          async (ctx) => {
            const { userVerification } = ctx.req.valid('json')
            const { app, token } = ctx.var
            const user = await app.db.users.findOne({ _id: token.sub })
            if (!user) throw new HTTPException(404)
            const credentials = await app.db.credentials
              .find({ userId: user._id, type: 'webauthn' })
              .toArray()
            const { hostname } = new URL(ctx.req.url)

            const options: any = await generateAuthenticationOptions({
              rpID: this.rpId || hostname,
              allowCredentials: credentials.map(({ secret }) => ({
                id: (secret as IWebauthnKey).id
              })),
              userVerification: userVerification ? 'required' : 'preferred'
            })
            await app.cache.setx(this.getCacheKey('verify', user._id), options, ms('5min'))
            return ctx.json({ options })
          }
        )
    )
  }
}
