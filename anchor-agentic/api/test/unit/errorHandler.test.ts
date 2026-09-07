import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/types'
import { errorHandler, logRejection } from '../../src/middleware/errorHandler'

describe('logRejection', () => {
  it('logs a structured record correlating the request id, path, and reason', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const app = new Hono<AppEnv>()
    app.get('/protected', (c) => {
      c.set('requestId', 'req-1')
      c.set('userId', null)
      logRejection(c, 403, 'not_owner')
      return c.json({ error: 'forbidden' }, 403)
    })

    await app.request('/protected')

    expect(logSpy).toHaveBeenCalledTimes(1)
    const [line] = logSpy.mock.calls[0]
    expect(JSON.parse(line as string)).toMatchObject({
      requestId: 'req-1',
      path: '/protected',
      method: 'GET',
      userId: null,
      status: 403,
      reason: 'not_owner',
    })
    logSpy.mockRestore()
  })
})

describe('errorHandler', () => {
  it('returns a 500 with the correlated request id and never leaks the raw error to the response', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = new Hono<AppEnv>()
    app.onError(errorHandler)
    app.get('/boom', (c) => {
      c.set('requestId', 'req-2')
      throw new Error('secret internal detail')
    })

    const res = await app.request('/boom')
    const body = await res.json<{ error: string; requestId: string }>()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'internal_error', requestId: 'req-2' })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })
})
