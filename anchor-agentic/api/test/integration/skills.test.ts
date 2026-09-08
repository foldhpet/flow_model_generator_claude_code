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

describe('skills routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/skills', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('POST / rejects an empty name', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request(
      '/api/v1/skills',
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

  it('POST / defaults skill_files to an empty array and is independent of any Role', async () => {
    const created = {
      id: 'skill-1',
      owner_id: OWNER_ID,
      name: 'Write unit tests',
      description: null,
      skill_files: [],
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: created, error: null })) // insert into skills
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/skills',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Write unit tests' }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ skill: created })
  })

  it('PATCH /:id rejects skill_files that is not an array', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'skill-1', owner_id: OWNER_ID }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/skills/skill-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_files: 'not-an-array' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_skill_files')
  })

  it('PATCH /:id filters out malformed entries within skill_files', async () => {
    const updated = {
      id: 'skill-1',
      owner_id: OWNER_ID,
      name: 'Write unit tests',
      description: null,
      skill_files: [{ path: 'a.md', content: 'hello' }],
      status: 'Draft',
      current_version: 2,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'skill-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
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
      '/api/v1/skills/skill-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_files: [{ path: 'a.md', content: 'hello' }, { path: '', content: 'dropped' }, { bogus: true }],
        }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ skill: updated })
  })

  it('PATCH /:id 403s a non-owner', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'skill-1', owner_id: OTHER_USER_ID }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/skills/skill-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hijacked' }),
      },
      testEnv,
    )

    expect(res.status).toBe(403)
  })

  it('PATCH /:id 400s any edit once the item is Archived, even without a status field in the body', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'skill-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { current_version: 3, status: 'Archived' }, error: null })) // fetch current_version/status
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/skills/skill-1',
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
      .mockReturnValueOnce(chain({ data: { id: 'skill-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { current_version: 2, status: 'Published' }, error: null })) // fetch current_version/status
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/skills/skill-1',
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
      id: 'skill-1',
      owner_id: OWNER_ID,
      name: 'Write unit tests',
      description: null,
      skill_files: [],
      status: 'Archived',
      current_version: 2,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'skill-1', owner_id: OWNER_ID }, error: null })) // checkOwnership
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
      '/api/v1/skills/skill-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archived' }),
      },
      testEnv,
    )
    const body = await res.json<{ skill: typeof archived }>()

    expect(res.status).toBe(200)
    expect(body.skill.status).toBe('Archived')
  })
})
