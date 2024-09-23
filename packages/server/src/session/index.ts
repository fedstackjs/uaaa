import { Hookable } from 'hookable'
import { BusinessError, Permission, UAAA } from '../util/index.js'
import type { App, ICredentialVerifyResult, ITokenPayload, SecurityLevel } from '../index.js'
import ms from 'ms'

export class SessionManager extends Hookable<{
  preElevate(token: ITokenPayload, verifyResult: ICredentialVerifyResult): void | Promise<void>
  preDerive(
    token: ITokenPayload,
    targetAppId: string | undefined,
    clientAppId: string,
    securityLevel: SecurityLevel
  ): void | Promise<void>
}> {
  constructor(public app: App) {
    super()
  }

  async elevate(token: ITokenPayload, verifyResult: ICredentialVerifyResult) {
    await this.callHook('preElevate', token, verifyResult)
    const session = await this.app.db.sessions.findOneAndUpdate(
      { _id: token.sid, terminated: { $ne: true } },
      { $inc: { tokenCount: 1 } },
      { returnDocument: 'before' }
    )
    if (!session) throw new BusinessError('BAD_REQUEST', { msg: 'Session not found' })
    const now = Date.now()
    const { credentialId, securityLevel, expiresIn, tokenTimeout, refreshTimeout } = verifyResult
    const newToken = await this.app.token.createAndSignToken({
      sessionId: token.sid,
      userId: token.sub,
      permissions: ['/**'],
      index: session.tokenCount,
      parentId: token.jti,
      credentialId,
      securityLevel,
      createdAt: now,
      expiresAt: now + this.app.token.getSessionTokenTimeout(securityLevel, expiresIn),
      tokenTimeout: this.app.token.getTokenTimeout(securityLevel, tokenTimeout),
      refreshTimeout: this.app.token.getRefreshTimeout(securityLevel, refreshTimeout)
    })
    return {
      token: newToken
    }
  }

  async checkDerive(
    token: ITokenPayload,
    targetAppId: string | undefined,
    clientAppId: string,
    securityLevel: SecurityLevel
  ) {
    if (token.client_id && !targetAppId) {
      throw new BusinessError('BAD_REQUEST', {
        msg: 'Secondary token can only derive application token'
      })
    }
    if (securityLevel > token.level) {
      throw new BusinessError('INSUFFICIENT_SECURITY_LEVEL', { required: securityLevel })
    }

    const clientApp = await this.app.db.apps.findOne({ _id: clientAppId, disabled: { $ne: true } })
    if (!clientApp) throw new BusinessError('NOT_FOUND', { msg: 'Client app not found' })
    if (securityLevel > clientApp.securityLevel) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Security level higher than client app' })
    }

    await this.callHook('preDerive', token, targetAppId, clientAppId, securityLevel)

    const installation = await this.app.db.installations.findOne({
      userId: token.sub,
      appId: clientAppId,
      disabled: { $ne: true }
    })
    if (!installation) {
      throw new BusinessError('APP_NOT_INSTALLED', {})
    }

    const permTarget = targetAppId ?? UAAA
    const permissions = installation.grantedPermissions
      .map((p) => Permission.fromCompactString(p))
      .filter((p) => p.appId === permTarget)
      .map((p) => p.toScopedString())
    if (!permissions.length) {
      throw new BusinessError('BAD_REQUEST', { msg: 'No permissions granted for target app' })
    }

    const timestamp = Date.now()
    const parentToken = await this.app.db.tokens.findOne({
      _id: token.jti,
      expiresAt: { $gt: timestamp },
      terminated: { $ne: true }
    })
    if (!parentToken) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Parent token not found' })
    }

    return { clientApp, installation, parentToken, permissions, timestamp }
  }

  async derive(
    token: ITokenPayload,
    targetAppId: string | undefined,
    clientAppId: string,
    securityLevel: SecurityLevel,
    options?: { nonce?: string; challenge?: string }
  ) {
    const { parentToken, permissions, timestamp } = await this.checkDerive(
      token,
      targetAppId,
      clientAppId,
      securityLevel
    )

    const session = await this.app.db.sessions.findOneAndUpdate(
      { _id: token.sid, terminated: { $ne: true } },
      { $inc: { tokenCount: 1 }, $addToSet: { authorizedApps: clientAppId } },
      { returnDocument: 'before' }
    )
    if (!session) {
      throw new BusinessError('BAD_REQUEST', { msg: 'Session not found' })
    }

    const { _id } = await this.app.token.createToken({
      sessionId: token.sid,
      userId: token.sub,
      index: session.tokenCount,
      targetAppId,
      clientAppId,
      permissions,
      parentId: parentToken._id,
      securityLevel,
      createdAt: timestamp,
      expiresAt: parentToken.expiresAt,
      // TODO: tokenTimeout and refreshTimeout should be configurable
      tokenTimeout: parentToken.tokenTimeout,
      refreshTimeout: parentToken.refreshTimeout,
      nonce: options?.nonce,
      challenge: options?.challenge
    })

    return {
      tokenId: _id
    }
  }
}
