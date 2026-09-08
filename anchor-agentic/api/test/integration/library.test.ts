import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

const OWNER_ID = 'owner-1'

function authedClient(fromImpl: () => ReturnType<typeof chain>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
    from: vi.fn(fromImpl),
  }
}

describe('library routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/library', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('GET / defaults to scope=all and returns paginated items with total', async () => {
    const items = [
      { item_type: 'ROLE', id: 'role-1', owner_id: OWNER_ID, name: 'BA', status: 'Draft', current_version: 1 },
    ]
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: items, error: null, count: 1 })))

    const app = createApp()
    const res = await app.request('/api/v1/library', {}, testEnv)
    const body = await res.json<{ items: unknown[]; total: number; page: number; pageSize: number }>()

    expect(res.status).toBe(200)
    expect(body.items).toEqual(items)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(20)
  })

  it('GET /?scope=mine restricts to the caller (owner filter applied server-side)', async () => {
    const fromMock = vi.fn(() => chain({ data: [], error: null, count: 0 }))
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request('/api/v1/library?scope=mine', {}, testEnv)

    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('library_items')
  })

  it('GET /:itemType/:id/versions 400s an unknown item type', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request('/api/v1/library/BOGUS/role-1/versions', {}, testEnv)
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it('GET /:itemType/:id/versions 404s when the parent item does not exist', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request('/api/v1/library/ROLE/missing/versions', {}, testEnv)

    expect(res.status).toBe(404)
  })

  it('GET /:itemType/:id/versions returns a paginated, newest-first snapshot list for any registered user', async () => {
    const versions = [
      { id: 'v2', item_type: 'ROLE', item_id: 'role-1', version_number: 2, snapshot_data: {}, created_by: 'x' },
      { id: 'v1', item_type: 'ROLE', item_id: 'role-1', version_number: 1, snapshot_data: {}, created_by: 'x' },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1' }, error: null })) // parent existence check
      .mockReturnValueOnce(chain({ data: versions, error: null, count: 2 })) // version_snapshots select
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'someone-else' } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request('/api/v1/library/ROLE/role-1/versions', {}, testEnv)
    const body = await res.json<{ versions: unknown[]; total: number }>()

    expect(res.status).toBe(200)
    expect(body.versions).toEqual(versions)
    expect(body.total).toBe(2)
  })
})
