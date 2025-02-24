import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
  Base64URLString,
  PublicKeyCredentialRequestOptionsJSON,
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/server'
import {
  CredentialImpl,
  type CredentialContext,
  type ICredentialBindResult,
  type ICredentialUnbindResult,
  type ICredentialVerifyResult
} from '../../../credential/_common.js'
import type { WebauthnPlugin } from './plugin.js'
import { HTTPException } from 'hono/http-exception'
import { verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server'
import { BusinessError } from '../../../util/errors.js'
import { type } from 'arktype'
import ms from 'ms'
import { SECURITY_LEVEL, type SecurityLevel } from '../../../util/index.js'

export interface IWebauthnKey {
  id: Base64URLString
  publicKey: string
  webauthnUserID: Base64URLString
  counter: number
  deviceType: CredentialDeviceType
  backedUp: boolean
  transports?: AuthenticatorTransportFuture[] | undefined
}

export class WebauthnImpl extends CredentialImpl {
  static tPayload = type({
    id: 'string'
  })

  readonly type = 'webauthn'
  app

  constructor(public plugin: WebauthnPlugin) {
    super()
    this.app = plugin.app
  }

  override async verify(
    ctx: CredentialContext,
    userId: string,
    targetLevel: SecurityLevel,
    payload: unknown
  ): Promise<ICredentialVerifyResult> {
    const body = WebauthnImpl.tPayload(payload)
    if (body instanceof type.errors) {
      throw new BusinessError('INVALID_TYPE', { summary: body.summary })
    }
    const currentOptions = await this.app.cache.getex<PublicKeyCredentialRequestOptionsJSON>(
      this.plugin.getCacheKey('verify', userId)
    )
    const credential = await this.app.db.credentials.findOne({
      _id: { $nin: await ctx.getCredentialIdBlacklist(this.type) },
      type: 'webauthn',
      userId,
      userIdentifier: body.id,
      securityLevel: { $gte: targetLevel }
    })
    if (!credential) {
      throw new BusinessError('NOT_FOUND', { msg: 'Credential not found' })
    }
    const passkey = credential.secret as IWebauthnKey
    try {
      const expectedOrigin = this.plugin.origin || new URL(ctx.httpCtx.req.url).origin
      const verification = await verifyAuthenticationResponse({
        response: body as AuthenticationResponseJSON,
        expectedChallenge: currentOptions.challenge,
        expectedOrigin,
        expectedRPID: this.plugin.rpId,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64')),
          counter: passkey.counter,
          transports: passkey.transports as AuthenticatorTransportFuture[]
        }
      })
      if (!verification.verified) {
        throw new Error('Verification failed')
      }
      await ctx.manager.checkCredentialUse(credential._id, {
        'secret.counter': verification.authenticationInfo.newCounter
      })
      return {
        credentialId: credential._id,
        securityLevel: credential.securityLevel,
        expiresIn: ms('30min')
      }
    } catch (err) {
      throw new BusinessError('BAD_REQUEST', { msg: `${err}` })
    }
  }

  override async bind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string | undefined,
    payload: unknown
  ): Promise<ICredentialBindResult> {
    if (credentialId) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Credential already bound' })
    }
    const currentOptions = await this.app.cache.getex<PublicKeyCredentialCreationOptionsJSON>(
      this.plugin.getCacheKey('bind', userId)
    )
    const expectedOrigin = this.plugin.origin || new URL(ctx.httpCtx.req.url).origin
    const verification = await verifyRegistrationResponse({
      response: payload as RegistrationResponseJSON,
      expectedChallenge: currentOptions.challenge,
      expectedOrigin,
      expectedRPID: this.plugin.rpId
    })
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Verification failed')
    }
    const info = verification.registrationInfo
    return {
      credentialId: await ctx.manager.bindCredential(ctx, 'webauthn', userId, credentialId, {
        userIdentifier: info.credential.id,
        globalIdentifier: info.credential.id,
        data: '',
        secret: {
          id: info.credential.id,
          webauthnUserID: currentOptions.user.id,
          publicKey: Buffer.from(info.credential.publicKey).toString('base64'),
          counter: info.credential.counter,
          deviceType: info.credentialDeviceType,
          backedUp: info.credentialBackedUp,
          transports: (payload as RegistrationResponseJSON).response.transports
        } as IWebauthnKey,
        remark: '',
        expiration: ms('100y'),
        validCount: Number.MAX_SAFE_INTEGER,
        securityLevel: SECURITY_LEVEL.HIGH
      })
    }
  }

  override async unbind(
    ctx: CredentialContext,
    userId: string,
    credentialId: string,
    payload: unknown
  ): Promise<ICredentialUnbindResult> {
    await ctx.manager.unbindCredential(ctx, 'webauthn', userId, credentialId)
    return {}
  }
}
