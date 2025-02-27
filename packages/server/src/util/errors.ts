import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export interface IErrorMap {
  INSUFFICIENT_SECURITY_LEVEL: { required: number }
  INSUFFICIENT_PERMISSION: { required: string[] }
  REQUIRE_ADMIN: {}
  INVALID_OPERATION: {}
  INVALID_TYPE: { summary: string }
  NOT_FOUND: { msg: string }
  BAD_REQUEST: { msg: string }
  APP_NOT_INSTALLED: {}
  APP_DISABLED: {}
  MISSING_REQUIRED_PERMISSIONS: { perms: string[] }
  MISSING_REQUIRED_CLAIMS: { claims: string[] }
  MISSING_VERIFIED_CLAIMS: { claims: string[] }
  INTERNAL_ERROR: { msg: string }
  DUPLICATE: { msg: string }
  CRED_NO_BIND_NEW: {}
  CRED_NO_UNBIND_LAST: {}
  CRED_VALIDATION_FAILED: { msg: string }
  FORBIDDEN: { msg: string }

  // Token
  TOKEN_INVALID_JWT: {}
  TOKEN_INVALID_REFRESH: {}
  TOKEN_INVALID_CONFIG: {}
  TOKEN_INVALID_CLIENT: {}
  TOKEN_TERMINATED: {}
  TOKEN_EXPIRED: {}
  TOKEN_PENDING: {}

  // Remote auth
  REMOTE_AUTH_BAD_USERCODE: {}
  REMOTE_AUTH_BAD_AUTHCODE: {}
  REMOTE_AUTH_EXPIRED: {}

  // Misc
  TOO_MANY_REQUESTS: { msg: string }
}

export type ErrorName = keyof IErrorMap

export const ErrorStatusMap: {
  [key in ErrorName]: ContentfulStatusCode
} = {
  INSUFFICIENT_SECURITY_LEVEL: 403,
  INSUFFICIENT_PERMISSION: 403,
  REQUIRE_ADMIN: 403,
  INVALID_OPERATION: 400,
  INVALID_TYPE: 400,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,

  APP_NOT_INSTALLED: 400,
  APP_DISABLED: 400,

  MISSING_REQUIRED_PERMISSIONS: 400,
  MISSING_REQUIRED_CLAIMS: 400,
  MISSING_VERIFIED_CLAIMS: 400,
  INTERNAL_ERROR: 500,
  DUPLICATE: 400,
  CRED_NO_BIND_NEW: 400,
  CRED_NO_UNBIND_LAST: 400,
  CRED_VALIDATION_FAILED: 403,
  FORBIDDEN: 403,

  TOKEN_INVALID_JWT: 403,
  TOKEN_INVALID_CLIENT: 403,
  TOKEN_INVALID_REFRESH: 403,
  TOKEN_INVALID_CONFIG: 403,
  TOKEN_PENDING: 403,
  TOKEN_TERMINATED: 403,
  TOKEN_EXPIRED: 403,

  REMOTE_AUTH_BAD_USERCODE: 400,
  REMOTE_AUTH_BAD_AUTHCODE: 400,
  REMOTE_AUTH_EXPIRED: 400,

  TOO_MANY_REQUESTS: 429
} as const

export class BusinessError<T extends ErrorName> extends HTTPException {
  constructor(
    public code: T,
    public data: IErrorMap[T],
    options?: { cause?: unknown }
  ) {
    super(ErrorStatusMap[code], {
      res: new Response(JSON.stringify({ code, data }), {
        status: ErrorStatusMap[code],
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      cause: options?.cause
    })
  }
}
