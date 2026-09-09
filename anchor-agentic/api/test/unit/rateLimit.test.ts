import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/types'
import { rateLimitByIp } from '../../src/middleware/rateLimit'

function fakeKv() {
  const store = new Map<string, string>()
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

function buildApp(limiter: ReturnType<typeof rateLimitByIp>) {
  const app = new Hono<AppEnv>()
  app.use('*', limiter)
  app.get('/', (c) => c.json({ ok: true }))
  return app
}

describe('rateLimitByIp', () => {
  it('fails open (allows the request) when RATE_LIMIT_KV is not bound', async () => {
    const app = buildApp(rateLimitByIp({ keyPrefix: 'test', limit: 1, windowSeconds: 60 }))

    const res = await app.request('/', { headers: { 'CF-Connecting-IP': '1.2.3.4' } }, {})

    expect(res.status).toBe(200)
  })

  it('allows requests under the limit and 429s once the limit is reached', async () => {
    const app = buildApp(rateLimitByIp({ keyPrefix: 'test', limit: 2, windowSeconds: 60 }))
    const env = { RATE_LIMIT_KV: fakeKv() }
    const headers = { 'CF-Connecting-IP': '1.2.3.4' }

    const first = await app.request('/', { headers }, env)
    const second = await app.request('/', { headers }, env)
    const third = await app.request('/', { headers }, env)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect((await third.json<{ error: string }>()).error).toBe('rate_limited')
  })

  it('tracks separate IPs independently', async () => {
    const app = buildApp(rateLimitByIp({ keyPrefix: 'test', limit: 1, windowSeconds: 60 }))
    const env = { RATE_LIMIT_KV: fakeKv() }

    const first = await app.request('/', { headers: { 'CF-Connecting-IP': '1.1.1.1' } }, env)
    const second = await app.request('/', { headers: { 'CF-Connecting-IP': '2.2.2.2' } }, env)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })
})
