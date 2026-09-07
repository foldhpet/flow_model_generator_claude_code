import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

describe('marketplace routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('GET /items returns the Published-filtered rows as-is', async () => {
    const items = [
      { id: '1', title: 'Foo', status: 'Published', owner_id: 'u1', created_at: 't', updated_at: 't' },
    ]
    createRequestSupabaseClient.mockReturnValue({ from: () => chain({ data: items, error: null }) })

    const app = createApp()
    const res = await app.request('/api/v1/marketplace/items', {}, testEnv)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ items })
  })

  it('GET /items returns an empty array (not an error) when nothing is published yet', async () => {
    createRequestSupabaseClient.mockReturnValue({ from: () => chain({ data: [], error: null }) })

    const app = createApp()
    const res = await app.request('/api/v1/marketplace/items', {}, testEnv)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ items: [] })
  })

  it('GET /items/:id 404s without distinguishing "does not exist" from "not visible"', async () => {
    createRequestSupabaseClient.mockReturnValue({ from: () => chain({ data: null, error: null }) })

    const app = createApp()
    const res = await app.request('/api/v1/marketplace/items/unknown-id', {}, testEnv)
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('GET /items/:id returns the item when found and Published', async () => {
    const item = { id: '1', title: 'Foo', status: 'Published', owner_id: 'u1', created_at: 't', updated_at: 't' }
    createRequestSupabaseClient.mockReturnValue({ from: () => chain({ data: item, error: null }) })

    const app = createApp()
    const res = await app.request('/api/v1/marketplace/items/1', {}, testEnv)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ item })
  })
})
