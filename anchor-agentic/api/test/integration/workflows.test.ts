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

function authedClientWithFrom(fromMock: ReturnType<typeof vi.fn>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
    from: fromMock,
  }
}

const WORKFLOW = {
  id: 'wf-1',
  owner_id: OWNER_ID,
  name: 'Ship a feature',
  description: null,
  status: 'Draft',
  current_version: 1,
  created_at: 't',
  updated_at: 't',
}

describe('workflows routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/workflows', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('POST / rejects an empty name', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_name')
  })

  it('POST / creates a Draft workflow with zero steps and records a version 1 snapshot', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: WORKFLOW, error: null })) // insert into workflows
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ship a feature' }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ workflow: WORKFLOW })
  })

  it('GET /:id/steps lists steps ordered by order_index', async () => {
    const steps = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 't1', agent_id: null, skill_id: null, created_at: 't' },
    ]
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: steps, error: null })))

    const app = createApp()
    const res = await app.request('/api/v1/workflows/wf-1/steps', {}, testEnv)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ steps })
  })

  it('PATCH /:id 403s a non-owner', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'wf-1', owner_id: OTHER_USER_ID, current_version: 1 }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hijacked' }),
      },
      testEnv,
    )

    expect(res.status).toBe(403)
  })

  it('PATCH /:id bumps current_version', async () => {
    const updated = { ...WORKFLOW, name: 'Renamed', current_version: 2 }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: updated, error: null })) // main update
      .mockReturnValueOnce(chain({ data: [], error: null })) // loadSteps for snapshot
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' }),
      },
      testEnv,
    )
    const body = await res.json<{ workflow: typeof updated }>()

    expect(res.status).toBe(200)
    expect(body.workflow.current_version).toBe(2)
  })

  it('POST /:id/steps rejects a step with no reference field populated', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_reference')
  })

  it('POST /:id/steps rejects referencing another owner’s non-Published task', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OTHER_USER_ID, status: 'Draft' }, error: null })) // canReference
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK', task_id: 'task-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('reference_not_allowed')
  })

  it('POST /:id/steps appends a step at the end and bumps the workflow version', async () => {
    const newStepList = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null, created_at: 't' },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OWNER_ID, status: 'Draft' }, error: null })) // canReference (own item)
      .mockReturnValueOnce(chain({ data: [], error: null })) // loadSteps (existing, empty -> order_index 0)
      .mockReturnValueOnce(chain({ data: null, error: null })) // insert workflow_steps
      .mockReturnValueOnce(chain({ data: { ...WORKFLOW, current_version: 2 }, error: null })) // bumpAndSnapshot: workflows update
      .mockReturnValueOnce(chain({ data: newStepList, error: null })) // bumpAndSnapshot: loadSteps
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // workflows update (recordVersionSnapshot bump)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK', task_id: 'task-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ workflow: { current_version: number }; steps: typeof newStepList }>()

    expect(res.status).toBe(201)
    expect(body.workflow.current_version).toBe(2)
    expect(body.steps).toEqual(newStepList)
  })

  it('DELETE /:id/steps/:stepId 404s a step that does not belong to the workflow', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: [], error: null })) // loadSteps (existing, empty)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/step-missing',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('step_not_found')
  })

  it('DELETE /:id/steps/:stepId removes the last remaining step with no renumbering needed', async () => {
    const existingSteps = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null, created_at: 't' },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: existingSteps, error: null })) // loadSteps (existing)
      .mockReturnValueOnce(chain({ data: null, error: null })) // delete workflow_steps
      // no renumber calls: zero steps remain
      .mockReturnValueOnce(chain({ data: { ...WORKFLOW, current_version: 2 }, error: null })) // bumpAndSnapshot: workflows update
      .mockReturnValueOnce(chain({ data: [], error: null })) // bumpAndSnapshot: loadSteps
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // workflows update (recordVersionSnapshot bump)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/step-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ workflow: { current_version: number }; steps: unknown[] }>()

    expect(res.status).toBe(200)
    expect(body.workflow.current_version).toBe(2)
    expect(body.steps).toEqual([])
  })

  it('PUT /:id/steps/reorder rejects a step_ids set that does not match the existing steps', async () => {
    const existingSteps = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null, created_at: 't' },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: existingSteps, error: null })) // loadSteps (existing)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/reorder',
      {
        method: 'PUT',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: ['step-1', 'step-does-not-exist'] }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('step_set_mismatch')
  })

  it('PUT /:id/steps/reorder renumbers to match the given order', async () => {
    const existingSteps = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null, created_at: 't' },
      { id: 'step-2', workflow_id: 'wf-1', order_index: 1, step_type: 'TASK', task_id: 'task-2', agent_id: null, skill_id: null, created_at: 't' },
    ]
    const reorderedSteps = [existingSteps[1], existingSteps[0]]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: existingSteps, error: null })) // loadSteps (existing)
      // renumberSteps: 2 steps -> negative pass (2 calls) + positive pass (2 calls)
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: { ...WORKFLOW, current_version: 2 }, error: null })) // bumpAndSnapshot: workflows update
      .mockReturnValueOnce(chain({ data: reorderedSteps, error: null })) // bumpAndSnapshot: loadSteps
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // workflows update (recordVersionSnapshot bump)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/reorder',
      {
        method: 'PUT',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: ['step-2', 'step-1'] }),
      },
      testEnv,
    )
    const body = await res.json<{ workflow: { current_version: number }; steps: typeof reorderedSteps }>()

    expect(res.status).toBe(200)
    expect(body.workflow.current_version).toBe(2)
    expect(body.steps).toEqual(reorderedSteps)
  })

  it('PATCH /:id 400s any edit once the item is Archived, even without a status field in the body', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Trying to edit anyway' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('PATCH /:id 400s Published -> Archived (only a Draft item can be archived)', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Published', current_version: 2 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archived' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('only_draft_can_be_archived')
  })

  it('PATCH /:id allows Draft -> Archived', async () => {
    const archived = { ...WORKFLOW, status: 'Archived', current_version: 2 }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Draft', current_version: 1 }, error: null }),
      ) // checkOwnership
      .mockReturnValueOnce(chain({ data: archived, error: null })) // main update
      .mockReturnValueOnce(chain({ data: [], error: null })) // loadSteps for snapshot
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archived' }),
      },
      testEnv,
    )
    const body = await res.json<{ workflow: typeof archived }>()

    expect(res.status).toBe(200)
    expect(body.workflow.status).toBe('Archived')
  })

  it('POST /:id/steps 400s when the workflow is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK', task_id: 'task-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('PATCH /:id/steps/:stepId 400s when the workflow is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/step-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK', task_id: 'task-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('DELETE /:id/steps/:stepId 400s when the workflow is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/step-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('PUT /:id/steps/reorder 400s when the workflow is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/reorder',
      {
        method: 'PUT',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: ['step-1'] }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })
})
