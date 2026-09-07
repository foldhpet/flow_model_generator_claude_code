import type { Context, ErrorHandler } from 'hono'
import type { AppEnv } from '../types'

// US-004 AC5: every 401/403 is logged with its correlated request ID.
export function logRejection(c: Context<AppEnv>, status: number, reason: string) {
  console.log(
    JSON.stringify({
      requestId: c.get('requestId'),
      path: c.req.path,
      method: c.req.method,
      userId: c.get('userId') ?? null,
      status,
      reason,
    }),
  )
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId')
  console.error(
    JSON.stringify({ requestId, path: c.req.path, method: c.req.method, error: err.message }),
  )
  return c.json({ error: 'internal_error', requestId }, 500)
}
