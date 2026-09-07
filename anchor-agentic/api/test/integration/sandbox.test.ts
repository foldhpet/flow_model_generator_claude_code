import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

const OWNER_ID = 'owner-1'
const OTHER_USER_ID = 'other-2'

function authedClient(fromImpl: () => ReturnType<typeof chain>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
    from: vi.fn(fromImpl),
  }
}

describe('sandbox routes: auth boundary', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s every sandbox sub-path when the caller has no valid session, before any handler runs', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/sandbox/items/does-not-matter', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('POST /items forces owner_id from the verified JWT, ignoring any owner_id in the request body', async () => {
    const created = {
      id: 'item-1',
      title: 'My item',
      status: 'Draft',
      owner_id: OWNER_ID,
      created_at: 't',
      updated_at: 't',
    }
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: created, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/sandbox/items',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My item', owner_id: OTHER_USER_ID }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ item: created })
  })

  it('PATCH /items/:id 404s when the item does not exist', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: null, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/sandbox/items/missing',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New title' }),
      },
      testEnv,
    )

    expect(res.status).toBe(404)
  })

  it('PATCH /items/:id 403s a non-owner and logs the rejection with the correlated request id', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'item-1', owner_id: OTHER_USER_ID }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/sandbox/items/item-1',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer whatever',
          'Content-Type': 'application/json',
          'x-request-id': 'req-boundary-1',
        },
        body: JSON.stringify({ title: 'Hijacked title' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"req-boundary-1"'),
    )
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"reason":"not_owner"'))
    logSpy.mockRestore()
  })

  it('PATCH /items/:id succeeds for the owner', async () => {
    const updated = {
      id: 'item-1',
      title: 'Updated title',
      status: 'Draft',
      owner_id: OWNER_ID,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'item-1', owner_id: OWNER_ID }, error: null }))
      .mockReturnValueOnce(chain({ data: updated, error: null }))
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/sandbox/items/item-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated title' }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ item: updated })
  })

  it('DELETE /items/:id 403s a non-owner', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'item-1', owner_id: OTHER_USER_ID }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/sandbox/items/item-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )

    expect(res.status).toBe(403)
  })
})
