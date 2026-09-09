import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

const USER_ID = 'user-1'

function authedClientWithFrom(fromMock: ReturnType<typeof vi.fn>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }) },
    from: fromMock,
  }
}

function post(path: string, body: unknown) {
  const app = createApp()
  return app.request(
    path,
    { method: 'POST', headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    testEnv,
  )
}

describe('ratings routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const res = await post('/api/v1/marketplace/items/AGENT/agent-1/rating', { score: 5 })

    expect(res.status).toBe(401)
  })

  it('400s an invalid itemType', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(vi.fn()))

    const res = await post('/api/v1/marketplace/items/ROLE/role-1/rating', { score: 5 })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it.each([0, 6, 3.5, 'five', null])('400s an invalid score of %s', async (score) => {
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(vi.fn()))

    const res = await post('/api/v1/marketplace/items/AGENT/agent-1/rating', { score })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_score')
  })

  it('404s when the item does not exist or is not Published', async () => {
    const fromMock = vi.fn().mockReturnValueOnce(chain({ data: null, error: null })) // marketplace_items lookup
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/marketplace/items/AGENT/missing/rating', { score: 4 })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('inserts a new rating and returns the freshly recomputed aggregate', async () => {
    const upsertMock = vi.fn().mockReturnValue(Promise.resolve({ error: null }))
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { item_type: 'AGENT', id: 'agent-1' }, error: null })) // marketplace_items lookup
      .mockReturnValueOnce({ upsert: upsertMock }) // ratings upsert
      .mockReturnValueOnce(chain({ data: { rating: 5, rating_count: 1 }, error: null })) // marketplace_items re-select
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/marketplace/items/AGENT/agent-1/rating', { score: 5 })
    const body = await res.json<{ myRating: number; rating: number; rating_count: number }>()

    expect(res.status).toBe(200)
    expect(body).toEqual({ myRating: 5, rating: 5, rating_count: 1 })
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ item_type: 'AGENT', item_id: 'agent-1', user_id: USER_ID, score: 5 }),
      { onConflict: 'item_type,item_id,user_id' },
    )
  })

  it('resubmitting updates the existing row via upsert rather than duplicating it', async () => {
    const upsertMock = vi.fn().mockReturnValue(Promise.resolve({ error: null }))
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { item_type: 'AGENT', id: 'agent-1' }, error: null })) // marketplace_items lookup
      .mockReturnValueOnce({ upsert: upsertMock }) // ratings upsert
      .mockReturnValueOnce(chain({ data: { rating: 2, rating_count: 1 }, error: null })) // marketplace_items re-select
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/marketplace/items/AGENT/agent-1/rating', { score: 2 })
    const body = await res.json<{ myRating: number; rating: number; rating_count: number }>()

    expect(res.status).toBe(200)
    // rating_count stays 1 — the upsert's onConflict target updated the rater's
    // existing row in place instead of inserting a second one (US-030 AC1/AC2).
    expect(body).toEqual({ myRating: 2, rating: 2, rating_count: 1 })
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ score: 2 }), { onConflict: 'item_type,item_id,user_id' })
  })
})
