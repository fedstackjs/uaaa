import { HTTPException } from 'hono/http-exception'
import { StatusCode } from 'hono/utils/http-status'

export interface IErrorMap {
  INSUFFICIENT_SECURITY_LEVEL: { required: number }
  INSUFFICIENT_PERMISSION: { required: string }
  REQUIRE_ADMIN: {}
}

export const ErrorStatusMap: {
  [key in keyof IErrorMap]: StatusCode
} = {
  INSUFFICIENT_SECURITY_LEVEL: 403,
  INSUFFICIENT_PERMISSION: 403,
  REQUIRE_ADMIN: 403
}

export class BusinessError<T extends keyof IErrorMap> extends HTTPException {
  constructor(public code: T, public data: IErrorMap[T], options?: { cause?: unknown }) {
    super(ErrorStatusMap[code], {
      res: new Response(JSON.stringify({ error: code, data }), {
        status: ErrorStatusMap[code],
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      cause: options?.cause
    })
  }
}
