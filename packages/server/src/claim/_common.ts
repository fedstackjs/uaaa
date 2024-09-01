import { Hookable } from 'hookable'
import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { App, IAppRequestedClaim, IClaim, IUserClaims, SecurityLevel } from '../index.js'
import { rAvatarHash, rEmail, rPhone, rUsername, SecurityLevels } from '../util/index.js'

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
  editable?: true | undefined
  /** Hidden */
  hidden?: true | undefined
  /** Basic */
  basic?: true | undefined
  /** Claim's security level */
  securityLevel: SecurityLevel
}

export class ClaimContext {
  app
  securityLevel

  constructor(public manager: ClaimManager, public httpCtx: Context) {
    this.app = manager.app
    this.securityLevel = httpCtx.var.token?.level ?? 0
  }
}

export class ClaimManager extends Hookable<{
  [key in `validate:${ClaimName}`]: (ctx: ClaimContext, value: string) => Promise<void>
}> {
  registry: Record<string, IClaimDescriptor> = Object.create(null)

  constructor(public app: App) {
    super()
    this.addBuiltinClaims()
  }

  addClaimDescriptor(descriptor: IClaimDescriptor) {
    if (!rClaimName.test(descriptor.name)) throw new Error('Invalid claim name')
    this.registry[descriptor.name] = descriptor
  }

  hasClaim(name: string): name is ClaimName {
    return Object.hasOwn(this.registry, name)
  }

  getClaimDescriptor(name: ClaimName) {
    return this.registry[name]
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
      if (this.hasClaim(name) && this.getClaimDescriptor(name).basic && value) {
        result[name] = value
      }
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
            throw new HTTPException(403, { cause: `Claim ${name} is not verified` })
          }
          result[name] = claim
          continue
        }
      }
      if (options.required) {
        throw new HTTPException(403, { cause: `Claim ${name} is required` })
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
      if (!rUsername.test(value)) {
        throw new HTTPException(400, { cause: `Invalid ${name}` })
      }
    }

    this.addClaimDescriptor({
      name: 'username',
      description: 'User name',
      editable: true,
      securityLevel: SecurityLevels.SL0,
      basic: true
    })
    this.hook('validate:username', reFilter(rUsername, 'username'))

    this.addClaimDescriptor({
      name: 'realname',
      description: 'Real name',
      securityLevel: SecurityLevels.SL0,
      basic: true
    })

    this.addClaimDescriptor({
      name: 'avatar_hash',
      description: 'Avatar hash',
      editable: true,
      securityLevel: SecurityLevels.SL0,
      basic: true
    })
    this.hook('validate:avatar_hash', reFilter(rAvatarHash, 'avatar hash'))

    this.addClaimDescriptor({
      name: 'email',
      description: 'Email',
      editable: true,
      securityLevel: SecurityLevels.SL0,
      basic: true
    })
    this.hook('validate:email', reFilter(rEmail, 'email'))

    this.addClaimDescriptor({
      name: 'phone',
      description: 'Phone number',
      editable: true,
      securityLevel: SecurityLevels.SL0
    })
    this.hook('validate:phone', reFilter(rPhone, 'phone'))

    this.addClaimDescriptor({
      name: 'is_admin',
      description: 'Is admin',
      securityLevel: SecurityLevels.SL4,
      basic: true
    })
  }
}
