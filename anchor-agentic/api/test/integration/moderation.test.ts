import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({ createRequestSupabaseClient: vi.fn() }))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

const MODERATOR_ID = 'mod-1'

function anonymousClient() {
  return { auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) }, from: vi.fn() }
}

function moderatorClient(fromMock: ReturnType<typeof vi.fn>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: MODERATOR_ID } }, error: null }) },
    from: fromMock,
  }
}

function moderatorProfileChain() {
  return chain({ data: { is_moderator: true }, error: null })
}

function nonModeratorProfileChain() {
  return chain({ data: { is_moderator: false }, error: null })
}

function req(path: string, method: string, body?: unknown) {
  const app = createApp()
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return app.request(path, init, testEnv)
}

const get = (path: string) => req(path, 'GET')
const post = (path: string, body?: unknown) => req(path, 'POST', body)

describe('moderation routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s an anonymous caller', async () => {
    createRequestSupabaseClient.mockReturnValue(anonymousClient())

    const res = await get('/api/v1/moderation/queue')

    expect(res.status).toBe(401)
  })

  it('403s an authenticated non-moderator', async () => {
    const fromMock = vi.fn().mockReturnValueOnce(nonModeratorProfileChain()) // requireModerator's profiles lookup
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await get('/api/v1/moderation/queue')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('GET /queue groups items with their open reports', async () => {
    const skillItem = {
      id: 'skill-1',
      owner_id: 'owner-1',
      name: 'Shelver',
      description: 'x',
      skill_files: [],
      status: 'UnderReview',
      current_version: 2,
      published_version: null,
      review_feedback: null,
      created_at: 't',
      updated_at: 't',
    }
    const openReport = {
      id: 'report-1',
      item_type: 'SKILL',
      item_id: 'skill-1',
      reporter_id: null,
      reason: 'ABUSIVE',
      detail: null,
      status: 'OPEN',
      created_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain()) // requireModerator
      .mockReturnValueOnce(chain({ data: [], error: null })) // agents
      .mockReturnValueOnce(chain({ data: [skillItem], error: null })) // skills
      .mockReturnValueOnce(chain({ data: [], error: null })) // workflows
      .mockReturnValueOnce(chain({ data: [openReport], error: null })) // abuse_reports
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await get('/api/v1/moderation/queue')
    const body = await res.json<{ queue: Array<{ item_type: string; id: string; reports: unknown[] }> }>()

    expect(res.status).toBe(200)
    expect(body.queue).toHaveLength(1)
    expect(body.queue[0]).toMatchObject({ item_type: 'SKILL', id: 'skill-1' })
    expect(body.queue[0].reports).toEqual([openReport])
  })

  it('GET /queue returns an empty queue with no extra query when nothing is UnderReview', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await get('/api/v1/moderation/queue')
    const body = await res.json<{ queue: unknown[] }>()

    expect(res.status).toBe(200)
    expect(body.queue).toEqual([])
    expect(fromMock).toHaveBeenCalledTimes(4)
  })

  it('approve: 400s item_not_under_review when the item is not UnderReview', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(chain({ data: { id: 'agent-1', status: 'Draft', current_version: 1 }, error: null }))
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/items/AGENT/agent-1/approve')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('item_not_under_review')
  })

  it('approve: 404s a nonexistent item', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(chain({ data: null, error: null }))
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/items/AGENT/missing/approve')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('approve: publishes without bumping current_version', async () => {
    let capturedPatch: Record<string, unknown> | undefined
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(chain({ data: { id: 'agent-1', status: 'UnderReview', current_version: 3 }, error: null }))
      .mockReturnValueOnce({
        update: (patch: Record<string, unknown>) => {
          capturedPatch = patch
          return chain({ data: { id: 'agent-1', status: 'Published', published_version: 3 }, error: null })
        },
      })
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/items/AGENT/agent-1/approve')
    const body = await res.json<{ approved: { item_type: string; id: string; version: number } }>()

    expect(res.status).toBe(200)
    expect(body.approved).toEqual({ item_type: 'AGENT', id: 'agent-1', version: 3 })
    expect(capturedPatch).toMatchObject({ status: 'Published', published_version: 3, review_feedback: null })
    expect(capturedPatch).not.toHaveProperty('current_version')
  })

  it('reject: sets Draft with the provided feedback, no version bump', async () => {
    let capturedPatch: Record<string, unknown> | undefined
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(chain({ data: { id: 'skill-1', status: 'UnderReview', current_version: 2 }, error: null }))
      .mockReturnValueOnce({
        update: (patch: Record<string, unknown>) => {
          capturedPatch = patch
          return chain({ data: { id: 'skill-1', status: 'Draft', review_feedback: 'needs more detail' }, error: null })
        },
      })
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/items/SKILL/skill-1/reject', { feedback: 'needs more detail' })
    const body = await res.json<{ rejected: { item_type: string; id: string } }>()

    expect(res.status).toBe(200)
    expect(body.rejected).toEqual({ item_type: 'SKILL', id: 'skill-1' })
    expect(capturedPatch).toEqual(expect.objectContaining({ status: 'Draft', review_feedback: 'needs more detail' }))
    expect(capturedPatch).not.toHaveProperty('current_version')
  })

  it('remove: sets Removed (terminal) and resolves open reports as RESOLVED_REMOVED', async () => {
    let itemPatch: Record<string, unknown> | undefined
    const reportsEqMock = vi.fn().mockReturnValue(chain({ data: null, error: null }))
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(chain({ data: { id: 'workflow-1', status: 'UnderReview', current_version: 1 }, error: null }))
      .mockReturnValueOnce({
        update: (patch: Record<string, unknown>) => {
          itemPatch = patch
          return chain({ data: { id: 'workflow-1', status: 'Removed' }, error: null })
        },
      })
      .mockReturnValueOnce({
        update: () => ({ eq: () => ({ eq: () => ({ eq: reportsEqMock }) }) }),
      })
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/items/WORKFLOW/workflow-1/remove')
    const body = await res.json<{ removed: { item_type: string; id: string } }>()

    expect(res.status).toBe(200)
    expect(body.removed).toEqual({ item_type: 'WORKFLOW', id: 'workflow-1' })
    expect(itemPatch).toEqual(expect.objectContaining({ status: 'Removed' }))
    expect(reportsEqMock).toHaveBeenCalledWith('status', 'OPEN')
  })

  it('remove: 400s item_not_under_review', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(chain({ data: { id: 'workflow-1', status: 'Published', current_version: 1 }, error: null }))
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/items/WORKFLOW/workflow-1/remove')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('item_not_under_review')
  })

  it('dismiss: restores the item to Published when it was the last open report', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(
        chain({ data: { id: 'report-1', item_type: 'AGENT', item_id: 'agent-1', status: 'OPEN' }, error: null }),
      ) // report lookup
      .mockReturnValueOnce(chain({ data: null, error: null })) // dismiss update
      .mockReturnValueOnce(chain({ data: null, error: null, count: 0 })) // remaining open-report count
      .mockReturnValueOnce(chain({ data: [{ id: 'agent-1' }], error: null })) // restore update

    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/reports/report-1/dismiss')
    const body = await res.json<{ dismissed: { report_id: string }; restored: boolean }>()

    expect(res.status).toBe(200)
    expect(body.dismissed).toEqual({ report_id: 'report-1' })
    expect(body.restored).toBe(true)
  })

  it('dismiss: does not restore the item while other open reports remain', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(
        chain({ data: { id: 'report-1', item_type: 'AGENT', item_id: 'agent-1', status: 'OPEN' }, error: null }),
      )
      .mockReturnValueOnce(chain({ data: null, error: null })) // dismiss update
      .mockReturnValueOnce(chain({ data: null, error: null, count: 1 })) // remaining open-report count

    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/reports/report-1/dismiss')
    const body = await res.json<{ dismissed: { report_id: string }; restored: boolean }>()

    expect(res.status).toBe(200)
    expect(body.restored).toBe(false)
    expect(fromMock).toHaveBeenCalledTimes(4)
  })

  it('dismiss: 400s a report that is already resolved', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(moderatorProfileChain())
      .mockReturnValueOnce(
        chain({
          data: { id: 'report-1', item_type: 'AGENT', item_id: 'agent-1', status: 'RESOLVED_DISMISSED' },
          error: null,
        }),
      )
    createRequestSupabaseClient.mockReturnValue(moderatorClient(fromMock))

    const res = await post('/api/v1/moderation/reports/report-1/dismiss')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('report_not_open')
  })
})
