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

describe('agents routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/agents', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('POST / rejects a role_id owned by someone else', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'role-1', owner_id: OTHER_USER_ID }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: 'role-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('role_not_owned')
  })

  it('POST / maps a duplicate-role unique violation to 409 role_already_has_agent', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1', owner_id: OWNER_ID }, error: null })) // role lookup
      .mockReturnValueOnce(chain({ data: null, error: { code: '23505', message: 'duplicate key' } })) // insert
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: 'role-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(409)
    expect(body.error).toBe('role_already_has_agent')
  })

  it('POST / succeeds for an owned role with no existing agent', async () => {
    const created = {
      id: 'agent-1',
      owner_id: OWNER_ID,
      role_id: 'role-1',
      system_prompt: null,
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1', owner_id: OWNER_ID }, error: null })) // role lookup
      .mockReturnValueOnce(chain({ data: created, error: null })) // insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: 'role-1' }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ agent: created })
  })

  it('PATCH /:id rejects an attempt to change role_id', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', current_version: 1 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: 'role-2' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('role_immutable')
  })

  it('POST /:id/tasks/:taskId rejects a task whose role_id does not match the agent', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1' }, error: null })) // agent
      .mockReturnValueOnce(chain({ data: { id: 'task-1', role_id: 'role-2' }, error: null })) // task
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1/tasks/task-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('task_role_mismatch')
  })

  it('POST /:id/tasks/:taskId assigns a matching-role task and bumps the agent version', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', current_version: 1 }, error: null }),
      ) // agent
      .mockReturnValueOnce(chain({ data: { id: 'task-1', role_id: 'role-1' }, error: null })) // task
      .mockReturnValueOnce(chain({ data: null, error: null })) // agent_tasks insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // agents version bump (route handler)
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // agents version bump (recordVersionSnapshot)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1/tasks/task-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )

    expect(res.status).toBe(204)
  })

  it('POST /:id/tasks/:taskId maps a duplicate assignment to 409 already_assigned', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', current_version: 1 }, error: null }),
      ) // agent
      .mockReturnValueOnce(chain({ data: { id: 'task-1', role_id: 'role-1' }, error: null })) // task
      .mockReturnValueOnce(chain({ data: null, error: { code: '23505', message: 'duplicate key' } })) // agent_tasks insert
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1/tasks/task-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(409)
    expect(body.error).toBe('already_assigned')
  })

  it('DELETE /:id/tasks/:taskId 403s a non-owner', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'agent-1', owner_id: OTHER_USER_ID, role_id: 'role-1', current_version: 1 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1/tasks/task-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )

    expect(res.status).toBe(403)
  })

  it('DELETE /:id/tasks/:taskId unassigns and bumps the agent version', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', current_version: 1 }, error: null }),
      ) // checkOwnership
      .mockReturnValueOnce(chain({ data: null, error: null })) // agent_tasks delete
      .mockReturnValueOnce(chain({ data: null, error: null })) // agents version bump (route handler)
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // agents version bump (recordVersionSnapshot)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1/tasks/task-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )

    expect(res.status).toBe(204)
  })

  it('PATCH /:id 400s any edit once the item is Archived, even without a status field in the body', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({
          data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', status: 'Archived', current_version: 3 },
          error: null,
        }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: 'Trying to edit anyway' }),
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
        chain({
          data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', status: 'Published', current_version: 2 },
          error: null,
        }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1',
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
    const archived = {
      id: 'agent-1',
      owner_id: OWNER_ID,
      role_id: 'role-1',
      system_prompt: null,
      status: 'Archived',
      current_version: 2,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', status: 'Draft', current_version: 1 },
          error: null,
        }),
      ) // checkOwnership
      .mockReturnValueOnce(chain({ data: { current_version: 1 }, error: null })) // fetch current_version
      .mockReturnValueOnce(chain({ data: archived, error: null })) // main update
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // agents version bump (recordVersionSnapshot)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archived' }),
      },
      testEnv,
    )
    const body = await res.json<{ agent: typeof archived }>()

    expect(res.status).toBe(200)
    expect(body.agent.status).toBe('Archived')
  })

  it('POST /:id/tasks/:taskId 400s when the parent agent is Archived', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', status: 'Archived', current_version: 3 },
          error: null,
        }),
      ) // agent
      .mockReturnValueOnce(chain({ data: { id: 'task-1', role_id: 'role-1' }, error: null })) // task
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1/tasks/task-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('DELETE /:id/tasks/:taskId 400s when the parent agent is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({
          data: { id: 'agent-1', owner_id: OWNER_ID, role_id: 'role-1', status: 'Archived', current_version: 3 },
          error: null,
        }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/agents/agent-1/tasks/task-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })
})
