import { Hookable } from 'hookable'
import type { Context } from 'hono'
import type { App, IAppRequestedClaim, IUserClaims, SecurityLevel } from '../index.js'
import {
  BusinessError,
  rAvatarHash,
  rEmail,
  rPhone,
  rUsername,
  SECURITY_LEVEL
} from '../util/index.js'

export const rClaimName = /^(?:[a-z0-9_]{1,32}:)?[a-z0-9_]{1,64}$/

export interface IClaimNames {
  username: string
  realname?: string | undefined
  avatar_hash?: string | undefined
  email?: string | undefined
  phone?: string | undefined
  is_admin?: string | undefined
}

export type ClaimName = keyof IClaimNames

export interface IClaimDescriptor {
  /** Claim name eg. username */
  name: ClaimName
  /** Claim description */
  description: string
  /** Can claim be edited by its user */
  editable?: boolean | SecurityLevel
  /** Hidden */
  hidden?: true | undefined
  /** Basic */
  basic?: true | undefined
  /** Claim's security level */
  securityLevel: SecurityLevel

  openid?: {
    alias?: string
    verifiable?: boolean
  }
}

export class ClaimContext {
  app
  securityLevel

  constructor(
    public manager: ClaimManager,
    public httpCtx: Context
  ) {
    this.app = manager.app
    this.securityLevel = httpCtx.var.token?.level ?? 0
  }
}

export class ClaimManager extends Hookable<{
  [key in `validate:${ClaimName}`]: (ctx: ClaimContext, value: string) => Promise<void>
}> {
  registry: Record<string, IClaimDescriptor> = Object.create(null)
  openidConfig

  constructor(public app: App) {
    super()
    this.addBuiltinClaims()
    this.openidConfig = app.config.get('openidClaimConfig')
  }

  addClaimDescriptor(descriptor: IClaimDescriptor) {
    if (!rClaimName.test(descriptor.name)) throw new Error('Invalid claim name')
    if (this.openidConfig?.[descriptor.name]) {
      descriptor.openid ??= this.openidConfig?.[descriptor.name]
    }
    this.registry[descriptor.name] = descriptor
  }

  hasClaim(name: string): name is ClaimName {
    return Object.hasOwn(this.registry, name)
  }

  getClaimDescriptor(name: ClaimName) {
    return this.registry[name]
  }

  getClaimDescriptors() {
    return Object.values(this.registry)
  }

  async filterClaimDescriptors(ctx: Context) {
    return this.getClaimDescriptors().filter(
      (descriptor) => !descriptor.hidden && descriptor.securityLevel <= ctx.var.token.level
    )
  }

  async verifyClaim(ctx: Context, name: ClaimName, value: string) {
    await this.callHook(`validate:${name}`, new ClaimContext(this, ctx), value)
  }

  async filterBasicClaims(
    ctx: Context,
    claims: Partial<IUserClaims>
  ): Promise<Partial<IUserClaims>> {
    const result: Partial<IUserClaims> = Object.create(null)
    for (const [name, value] of Object.entries(claims)) {
      if (!value || !this.hasClaim(name)) {
        continue
      }
      const descriptor = this.getClaimDescriptor(name)
      if (!descriptor.basic || descriptor.securityLevel > ctx.var.token.level) {
        continue
      }
      result[name] = value
    }
    return result
  }

  async filterClaimsForApp(
    ctx: Context,
    granted: string[],
    requested: IAppRequestedClaim[],
    claims: Partial<IUserClaims>
  ): Promise<Partial<IUserClaims>> {
    const grantedSet = new Set(granted)
    const result: Partial<IUserClaims> = Object.create(null)
    for (const { name, ...options } of requested) {
      if (this.hasClaim(name) && grantedSet.has(name)) {
        const claim = claims[name]
        const descriptor = this.getClaimDescriptor(name)
        if (claim && descriptor.securityLevel <= ctx.var.token.level) {
          if (options.verified && !claim.verified) {
            throw new BusinessError('MISSING_VERIFIED_CLAIMS', { claims: [name] })
          }
          result[name] = claim
          continue
        }
      }
      if (options.required) {
        throw new BusinessError('MISSING_REQUIRED_CLAIMS', { claims: [name] })
      }
    }
    return result
  }

  async filterClaimsForUser(
    ctx: Context,
    claims: Partial<IUserClaims>
  ): Promise<Partial<IUserClaims>> {
    const result: Partial<IUserClaims> = Object.create(null)
    for (const [name, value] of Object.entries(claims)) {
      if (!value || !this.hasClaim(name)) {
        continue
      }
      const descriptor = this.getClaimDescriptor(name)
      if (descriptor.hidden || descriptor.securityLevel > ctx.var.token.level) {
        continue
      }
      result[name] = value
    }
    return result
  }

  private addBuiltinClaims() {
    const reFilter = (re: RegExp, name: string) => async (ctx: ClaimContext, value: string) => {
      if (!re.test(value)) {
        throw new BusinessError('BAD_REQUEST', { msg: `Invalid ${name}` })
      }
    }

    this.addClaimDescriptor({
      name: 'username',
      description: 'User name',
      editable: SECURITY_LEVEL.MEDIUM,
      securityLevel: SECURITY_LEVEL.LOW,
      basic: true,
      openid: { alias: 'nickname' }
    })
    this.hook('validate:username', reFilter(rUsername, 'username'))

    this.addClaimDescriptor({
      name: 'realname',
      description: 'Real name',
      securityLevel: SECURITY_LEVEL.LOW,
      basic: true,
      openid: { alias: 'name', verifiable: true }
    })

    this.addClaimDescriptor({
      name: 'avatar_hash',
      description: 'Avatar hash',
      editable: true,
      securityLevel: SECURITY_LEVEL.LOW,
      basic: true
    })
    this.hook('validate:avatar_hash', reFilter(rAvatarHash, 'avatar hash'))

    this.addClaimDescriptor({
      name: 'email',
      description: 'Email',
      editable: true,
      securityLevel: SECURITY_LEVEL.LOW,
      basic: true,
      openid: { verifiable: true }
    })
    this.hook('validate:email', reFilter(rEmail, 'email'))

    this.addClaimDescriptor({
      name: 'phone',
      description: 'Phone number',
      editable: true,
      securityLevel: SECURITY_LEVEL.LOW,
      basic: true,
      openid: { alias: 'phone_number', verifiable: true }
    })
    this.hook('validate:phone', reFilter(rPhone, 'phone'))

    this.addClaimDescriptor({
      name: 'is_admin',
      description: 'Is admin',
      securityLevel: SECURITY_LEVEL.MAX,
      basic: true
    })
  }
}
