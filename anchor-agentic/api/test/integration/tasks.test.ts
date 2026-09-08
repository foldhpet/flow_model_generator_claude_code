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

describe('tasks routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/tasks', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('POST / rejects a missing role_id', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request(
      '/api/v1/tasks',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Do the thing' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('role_id_required')
  })

  it('POST / rejects a role_id owned by someone else', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'role-1', owner_id: OTHER_USER_ID }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/tasks',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Do the thing', role_id: 'role-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('role_not_owned')
  })

  it('POST / succeeds with an owned role_id and records a version 1 snapshot', async () => {
    const created = {
      id: 'task-1',
      owner_id: OWNER_ID,
      role_id: 'role-1',
      name: 'Do the thing',
      instructions: null,
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1', owner_id: OWNER_ID }, error: null })) // role lookup
      .mockReturnValueOnce(chain({ data: created, error: null })) // insert into tasks
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/tasks',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Do the thing', role_id: 'role-1' }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ task: created })
  })

  it('PATCH /:id rejects an attempt to change role_id (no re-parenting)', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { role_id: 'role-1' }, error: null })) // existing role_id fetch
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/tasks/task-1',
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

  it('PATCH /:id allows re-sending the same role_id unchanged', async () => {
    const updated = {
      id: 'task-1',
      owner_id: OWNER_ID,
      role_id: 'role-1',
      name: 'Renamed',
      instructions: null,
      status: 'Draft',
      current_version: 2,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { role_id: 'role-1' }, error: null })) // existing role_id fetch
      .mockReturnValueOnce(chain({ data: { current_version: 1 }, error: null })) // fetch current_version
      .mockReturnValueOnce(chain({ data: updated, error: null })) // main update
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/tasks/task-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: 'role-1', name: 'Renamed' }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ task: updated })
  })

  it('GET / filters by role_id when provided', async () => {
    const tasks = [{ id: 'task-1', role_id: 'role-1' }]
    let capturedFilter: [string, string] | null = null
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => {
        const builder = chain({ data: tasks, error: null })
        const originalEq = builder.eq.bind(builder)
        // capture the filter used to prove ?role_id= is actually applied
        ;(builder as any).eq = (col: string, val: string) => {
          capturedFilter = [col, val]
          return originalEq()
        }
        return builder
      }),
    )

    const app = createApp()
    const res = await app.request('/api/v1/tasks?role_id=role-1', {}, testEnv)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ tasks })
    expect(capturedFilter).toEqual(['role_id', 'role-1'])
  })

  it('PATCH /:id 400s any edit once the item is Archived, even without a status field in the body', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { current_version: 3, status: 'Archived' }, error: null })) // fetch current_version/status
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/tasks/task-1',
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
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { current_version: 2, status: 'Published' }, error: null })) // fetch current_version/status
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/tasks/task-1',
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
      id: 'task-1',
      owner_id: OWNER_ID,
      role_id: 'role-1',
      name: 'Do the thing',
      instructions: null,
      status: 'Archived',
      current_version: 2,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { current_version: 1, status: 'Draft' }, error: null })) // fetch current_version/status
      .mockReturnValueOnce(chain({ data: archived, error: null })) // main update
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/tasks/task-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archived' }),
      },
      testEnv,
    )
    const body = await res.json<{ task: typeof archived }>()

    expect(res.status).toBe(200)
    expect(body.task.status).toBe('Archived')
  })
})
