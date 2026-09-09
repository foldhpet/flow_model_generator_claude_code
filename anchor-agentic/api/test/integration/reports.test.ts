import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient, createServiceRoleClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient, createServiceRoleClient }))

const USER_ID = 'user-1'

function anonymousClientWithFrom(fromMock: ReturnType<typeof vi.fn>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    from: fromMock,
  }
}

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
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    testEnv,
  )
}

describe('reports routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
    createServiceRoleClient.mockReset()
  })

  it('400s an invalid itemType', async () => {
    createRequestSupabaseClient.mockReturnValue(anonymousClientWithFrom(vi.fn()))

    const res = await post('/api/v1/marketplace/items/ROLE/role-1/report', { reason: 'ABUSIVE' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it('400s an invalid reason', async () => {
    createRequestSupabaseClient.mockReturnValue(anonymousClientWithFrom(vi.fn()))

    const res = await post('/api/v1/marketplace/items/AGENT/agent-1/report', { reason: 'MADE_UP' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_reason')
  })

  it('400s a detail longer than 2000 characters', async () => {
    createRequestSupabaseClient.mockReturnValue(anonymousClientWithFrom(vi.fn()))

    const res = await post('/api/v1/marketplace/items/AGENT/agent-1/report', {
      reason: 'ABUSIVE',
      detail: 'x'.repeat(2001),
    })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('detail_too_long')
  })

  it('404s when the item is not visible in the Marketplace (not Published)', async () => {
    const fromMock = vi.fn().mockReturnValueOnce(chain({ data: null, error: null })) // marketplace_items lookup
    createRequestSupabaseClient.mockReturnValue(anonymousClientWithFrom(fromMock))

    const res = await post('/api/v1/marketplace/items/AGENT/missing/report', { reason: 'BROKEN' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('records an anonymous report with a null reporter_id and flips the item to UnderReview', async () => {
    const insertedReport = {
      id: 'report-1',
      item_type: 'AGENT',
      item_id: 'agent-1',
      reporter_id: null,
      reason: 'ABUSIVE',
      status: 'OPEN',
      created_at: 't',
    }
    const insertMock = vi.fn().mockReturnValue(chain({ data: insertedReport, error: null }))
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { item_type: 'AGENT', id: 'agent-1' }, error: null })) // marketplace_items lookup
      .mockReturnValueOnce({ insert: insertMock }) // abuse_reports insert
    createRequestSupabaseClient.mockReturnValue(anonymousClientWithFrom(fromMock))

    const updateEqMock = vi.fn().mockReturnValue(chain({ data: null, error: null }))
    const serviceFromMock = vi.fn().mockReturnValue({ update: () => ({ eq: () => ({ eq: updateEqMock }) }) })
    createServiceRoleClient.mockReturnValue({ from: serviceFromMock })

    const res = await post('/api/v1/marketplace/items/AGENT/agent-1/report', { reason: 'ABUSIVE' })
    const body = await res.json<{ report: typeof insertedReport }>()

    expect(res.status).toBe(201)
    expect(body.report).toEqual(insertedReport)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ item_type: 'AGENT', item_id: 'agent-1', reporter_id: null, reason: 'ABUSIVE' }),
    )
    expect(serviceFromMock).toHaveBeenCalledWith('agents')
    expect(updateEqMock).toHaveBeenCalledWith('status', 'Published')
  })

  it('records an authenticated report with the caller as reporter_id', async () => {
    const insertedReport = {
      id: 'report-2',
      item_type: 'SKILL',
      item_id: 'skill-1',
      reporter_id: USER_ID,
      reason: 'SPAM',
      status: 'OPEN',
      created_at: 't',
    }
    const insertMock = vi.fn().mockReturnValue(chain({ data: insertedReport, error: null }))
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { item_type: 'SKILL', id: 'skill-1' }, error: null })) // marketplace_items lookup
      .mockReturnValueOnce({ insert: insertMock }) // abuse_reports insert
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))
    createServiceRoleClient.mockReturnValue({
      from: () => ({ update: () => ({ eq: () => ({ eq: () => chain({ data: null, error: null }) }) }) }),
    })

    const res = await post('/api/v1/marketplace/items/SKILL/skill-1/report', { reason: 'SPAM' })
    const body = await res.json<{ report: typeof insertedReport }>()

    expect(res.status).toBe(201)
    expect(body.report.reporter_id).toBe(USER_ID)
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: USER_ID }))
  })

  it('429s once the per-IP rate limit is reached', async () => {
    createRequestSupabaseClient.mockReturnValue(anonymousClientWithFrom(vi.fn()))

    const kv = {
      get: vi.fn().mockResolvedValue('5'),
      put: vi.fn(),
    }
    const app = createApp()
    const res = await app.request(
      '/api/v1/marketplace/items/AGENT/agent-1/report',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '9.9.9.9' },
        body: JSON.stringify({ reason: 'ABUSIVE' }),
      },
      { ...testEnv, RATE_LIMIT_KV: kv },
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(429)
    expect(body.error).toBe('rate_limited')
  })
})
