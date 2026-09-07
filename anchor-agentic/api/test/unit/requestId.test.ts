import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/types'
import { requestId } from '../../src/middleware/requestId'

function buildApp() {
  const app = new Hono<AppEnv>()
  app.use('*', requestId)
  app.get('/', (c) => c.json({ requestId: c.get('requestId') }))
  return app
}

describe('requestId middleware', () => {
  it('generates a request id when none is provided', async () => {
    const app = buildApp()
    const res = await app.request('/')
    const body = await res.json<{ requestId: string }>()

    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.headers.get('x-request-id')).toBe(body.requestId)
  })

  it('reuses an incoming x-request-id header', async () => {
    const app = buildApp()
    const res = await app.request('/', { headers: { 'x-request-id': 'test-fixed-id' } })
    const body = await res.json<{ requestId: string }>()

    expect(body.requestId).toBe('test-fixed-id')
    expect(res.headers.get('x-request-id')).toBe('test-fixed-id')
  })
})
