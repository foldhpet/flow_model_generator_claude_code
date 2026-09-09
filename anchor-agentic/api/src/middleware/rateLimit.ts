import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'

interface RateLimitOptions {
  keyPrefix: string
  limit: number
  windowSeconds: number
}

// US-045: per-IP rate limiting for the anonymous-friendly report endpoint.
// Fails open (no limiting) when RATE_LIMIT_KV isn't bound, matching
// EXPORT_BUCKET's pattern for an optional binding that isn't provisioned in
// every environment.
export function rateLimitByIp(options: RateLimitOptions) {
  const { keyPrefix, limit, windowSeconds } = options
  return createMiddleware<AppEnv>(async (c, next) => {
    const kv = c.env.RATE_LIMIT_KV
    if (!kv) {
      await next()
      return
    }

    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? 'unknown'
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
    const key = `${keyPrefix}:${ip}:${bucket}`

    const current = await kv.get(key)
    const count = current ? parseInt(current, 10) : 0

    if (count >= limit) {
      return c.json({ error: 'rate_limited', requestId: c.get('requestId') }, 429)
    }

    await kv.put(key, String(count + 1), { expirationTtl: windowSeconds * 2 })
    await next()
  })
}
