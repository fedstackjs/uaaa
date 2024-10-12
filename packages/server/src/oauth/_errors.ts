import { HTTPException } from 'hono/http-exception'

export class OAuthError extends HTTPException {
  constructor(
    public code:
      | 'invalid_request'
      | 'invalid_client'
      | 'invalid_grant'
      | 'unauthorized_client'
      | 'unsupported_grant_type'
      | 'invalid_scope'
      | 'authorization_pending'
      | 'slow_down'
      | 'access_denied'
      | 'expired_token',
    options?: {
      description?: string
      uri?: string
      cause?: unknown
    }
  ) {
    const response = {
      error: code,
      error_description: options?.description,
      error_uri: options?.uri
    }
    super(400, {
      res: new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }),
      cause: options?.cause
    })
  }
}
