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

describe('roles routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/roles', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('GET /:id 404s when the role does not exist', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request('/api/v1/roles/missing', {}, testEnv)

    expect(res.status).toBe(404)
  })

  it('POST / rejects an empty name before touching the database', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request(
      '/api/v1/roles',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_name')
  })

  it('POST / forces owner_id from the verified JWT and records a version 1 snapshot', async () => {
    const created = {
      id: 'role-1',
      name: 'Business Analyst',
      description: null,
      status: 'Draft',
      owner_id: OWNER_ID,
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: created, error: null })) // insert into roles
      .mockReturnValueOnce(chain({ data: null, error: null })) // insert into version_snapshots
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/roles',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Business Analyst', owner_id: OTHER_USER_ID }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ role: created })
    expect(fromMock).toHaveBeenCalledWith('roles')
    expect(fromMock).toHaveBeenCalledWith('version_snapshots')
  })

  it('PATCH /:id 403s a non-owner and logs the rejection', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'role-1', owner_id: OTHER_USER_ID }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/roles/role-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hijacked' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"reason":"not_owner"'))
    logSpy.mockRestore()
  })

  it('PATCH /:id bumps current_version and reflects the new value in the response', async () => {
    const updated = {
      id: 'role-1',
      name: 'Updated name',
      description: null,
      status: 'Draft',
      owner_id: OWNER_ID,
      current_version: 2,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
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
      '/api/v1/roles/role-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated name' }),
      },
      testEnv,
    )
    const body = await res.json<{ role: typeof updated }>()

    expect(res.status).toBe(200)
    expect(body.role.current_version).toBe(2)
  })

  it('PATCH /:id 400s any edit once the item is Archived, even without a status field in the body', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { current_version: 3, status: 'Archived' }, error: null })) // fetch current_version/status
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/roles/role-1',
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
      .mockReturnValueOnce(chain({ data: { id: 'role-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { current_version: 2, status: 'Published' }, error: null })) // fetch current_version/status
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/roles/role-1',
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
      id: 'role-1',
      name: 'Business Analyst',
      description: null,
      status: 'Archived',
      owner_id: OWNER_ID,
      current_version: 2,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
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
      '/api/v1/roles/role-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archived' }),
      },
      testEnv,
    )
    const body = await res.json<{ role: typeof archived }>()

    expect(res.status).toBe(200)
    expect(body.role.status).toBe('Archived')
  })
})
