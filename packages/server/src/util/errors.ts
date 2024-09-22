import { HTTPException } from 'hono/http-exception'
import type { StatusCode } from 'hono/utils/http-status'

export interface IErrorMap {
  INSUFFICIENT_SECURITY_LEVEL: { required: number }
  INSUFFICIENT_PERMISSION: { required: string }
  REQUIRE_ADMIN: {}
  INVALID_OPERATION: {}
  INVALID_TYPE: { summary: string }
  NOT_FOUND: { msg: string }
  BAD_REQUEST: { msg: string }
  APP_NOT_INSTALLED: {}
  MISSING_REQUIRED_PERMISSIONS: { perms: string[] }
  MISSING_REQUIRED_CLAIMS: { claims: string[] }
  MISSING_VERIFIED_CLAIMS: { claims: string[] }
  INTERNAL_ERROR: { msg: string }
  DUPLICATE: { msg: string }
  CRED_NO_BIND_NEW: {}
  CRED_NO_UNBIND_LAST: {}
  CRED_VALIDATION_FAILED: { msg: string }
  FORBIDDEN: { msg: string }
  INVALID_TOKEN: {}
  TOKEN_TERMINATED: {}
  TOKEN_EXPIRED: {}
  TOKEN_NOT_BEFORE: {}
  TOKEN_REQUIRED: {}
}

export type ErrorName = keyof IErrorMap

export const ErrorStatusMap: {
  [key in ErrorName]: StatusCode
} = {
  INSUFFICIENT_SECURITY_LEVEL: 403,
  INSUFFICIENT_PERMISSION: 403,
  REQUIRE_ADMIN: 403,
  INVALID_OPERATION: 400,
  INVALID_TYPE: 400,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  APP_NOT_INSTALLED: 400,
  MISSING_REQUIRED_PERMISSIONS: 400,
  MISSING_REQUIRED_CLAIMS: 400,
  MISSING_VERIFIED_CLAIMS: 400,
  INTERNAL_ERROR: 500,
  DUPLICATE: 400,
  CRED_NO_BIND_NEW: 400,
  CRED_NO_UNBIND_LAST: 400,
  CRED_VALIDATION_FAILED: 403,
  FORBIDDEN: 403,
  INVALID_TOKEN: 403,
  TOKEN_TERMINATED: 403,
  TOKEN_EXPIRED: 403,
  TOKEN_NOT_BEFORE: 403,
  TOKEN_REQUIRED: 401
}

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
