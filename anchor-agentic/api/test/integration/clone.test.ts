import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

const USER_ID = 'user-1'

function authedClient(fromImpl: () => ReturnType<typeof chain>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }) },
    from: vi.fn(fromImpl),
  }
}

function authedClientWithFrom(fromMock: ReturnType<typeof vi.fn>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }) },
    from: fromMock,
  }
}

describe('clone routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/SKILL/skill-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )

    expect(res.status).toBe(401)
  })

  it('POST /:itemType/:id 400s an itemType of ROLE (Roles have no standalone clone action)', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/ROLE/role-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it('POST /:itemType/:id 404s an unknown source item', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/SKILL/missing',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('POST /:itemType/:id 400s source_not_published on a Draft source', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'skill-1', status: 'Draft' }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/SKILL/skill-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('source_not_published')
  })

  it('POST /SKILL/:id creates one new owned Skill row, one snapshot, and one clone_record', async () => {
    const newSkill = {
      id: 'skill-2',
      owner_id: USER_ID,
      name: 'Shelver',
      description: 'Shelve things',
      skill_files: [{ path: 'SKILL.md', content: '# Shelver' }],
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'skill-1', status: 'Published' }, error: null })) // source status check
      .mockReturnValueOnce(
        chain({ data: { name: 'Shelver', description: 'Shelve things', skill_files: newSkill.skill_files }, error: null }),
      ) // cloneSkill: select source fields
      .mockReturnValueOnce(chain({ data: newSkill, error: null })) // cloneSkill: insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // skills update (version bump)
      .mockReturnValueOnce(chain({ data: null, error: null })) // clone_records insert
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/SKILL/skill-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ cloned: { item_type: string; id: string } }>()

    expect(res.status).toBe(201)
    expect(body.cloned).toEqual({ item_type: 'SKILL', id: 'skill-2' })
    expect(fromMock).toHaveBeenCalledWith('version_snapshots')
    expect(fromMock).toHaveBeenCalledWith('clone_records')
    expect(fromMock.mock.calls.filter((call) => call[0] === 'skills')).toHaveLength(4)
  })

  it('POST /AGENT/:id clones the Role and every assigned Task, wiring new agent_tasks rows to the new ids', async () => {
    const newRole = {
      id: 'role-2',
      owner_id: USER_ID,
      name: 'Librarian',
      description: null,
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const newAgent = {
      id: 'agent-2',
      owner_id: USER_ID,
      role_id: 'role-2',
      system_prompt: 'Be a librarian',
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const newTask = {
      id: 'task-2',
      owner_id: USER_ID,
      role_id: 'role-2',
      name: 'Catalog items',
      instructions: 'Catalog things',
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'agent-1', status: 'Published' }, error: null })) // source status check
      .mockReturnValueOnce(chain({ data: { role_id: 'role-1', system_prompt: 'Be a librarian' }, error: null })) // cloneAgent: select
      .mockReturnValueOnce(chain({ data: [{ task_id: 'task-1' }], error: null })) // agent_tasks assignments
      .mockReturnValueOnce(chain({ data: { name: 'Librarian', description: null }, error: null })) // cloneRole: select
      .mockReturnValueOnce(chain({ data: newRole, error: null })) // cloneRole: insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert (ROLE)
      .mockReturnValueOnce(chain({ data: null, error: null })) // roles update bump
      .mockReturnValueOnce(chain({ data: newAgent, error: null })) // cloneAgent: insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert (AGENT)
      .mockReturnValueOnce(chain({ data: null, error: null })) // agents update bump
      .mockReturnValueOnce(
        chain({ data: { name: 'Catalog items', instructions: 'Catalog things', role_id: 'role-1' }, error: null }),
      ) // cloneTask: select (role-1 already cached -> cloneRole dedup, no extra calls)
      .mockReturnValueOnce(chain({ data: newTask, error: null })) // cloneTask: insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert (TASK)
      .mockReturnValueOnce(chain({ data: null, error: null })) // tasks update bump
      .mockReturnValueOnce(chain({ data: null, error: null })) // agent_tasks insert (link)
      .mockReturnValueOnce(chain({ data: null, error: null })) // clone_records insert
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/AGENT/agent-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ cloned: { item_type: string; id: string } }>()

    expect(res.status).toBe(201)
    expect(body.cloned).toEqual({ item_type: 'AGENT', id: 'agent-2' })
    // Exactly one Role and one Task inserted despite the Agent + its single
    // assigned Task both referencing role-1 (cloneRole dedupes across them).
    expect(fromMock.mock.calls.filter((call) => call[0] === 'roles')).toHaveLength(3)
    expect(fromMock.mock.calls.filter((call) => call[0] === 'tasks')).toHaveLength(3)
    expect(fromMock.mock.calls.filter((call) => call[0] === 'agent_tasks')).toHaveLength(2)
  })

  it('POST /WORKFLOW/:id dedupes a Task referenced by two steps into a single new Task row', async () => {
    const sourceSteps = [
      {
        id: 'step-1',
        workflow_id: 'wf-1',
        order_index: 0,
        step_type: 'TASK',
        task_id: 'task-1',
        agent_id: null,
        skill_id: null,
        created_at: 't',
      },
      {
        id: 'step-2',
        workflow_id: 'wf-1',
        order_index: 1,
        step_type: 'TASK',
        task_id: 'task-1',
        agent_id: null,
        skill_id: null,
        created_at: 't',
      },
    ]
    const newWorkflow = {
      id: 'wf-2',
      owner_id: USER_ID,
      name: 'Cataloging Flow',
      description: null,
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const newRole = {
      id: 'role-2',
      owner_id: USER_ID,
      name: 'Librarian',
      description: null,
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const newTask = {
      id: 'task-2',
      owner_id: USER_ID,
      role_id: 'role-2',
      name: 'Catalog items',
      instructions: 'Catalog things',
      status: 'Draft',
      current_version: 1,
      created_at: 't',
      updated_at: 't',
    }
    const newSteps = [
      { ...sourceSteps[0], id: 'newstep-1', workflow_id: 'wf-2', task_id: 'task-2' },
      { ...sourceSteps[1], id: 'newstep-2', workflow_id: 'wf-2', task_id: 'task-2' },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', status: 'Published' }, error: null })) // source status check
      .mockReturnValueOnce(chain({ data: { name: 'Cataloging Flow', description: null }, error: null })) // cloneWorkflow: select
      .mockReturnValueOnce(chain({ data: sourceSteps, error: null })) // loadSteps (source)
      .mockReturnValueOnce(chain({ data: newWorkflow, error: null })) // insert new workflow
      .mockReturnValueOnce(
        chain({ data: { name: 'Catalog items', instructions: 'Catalog things', role_id: 'role-1' }, error: null }),
      ) // cloneTask (step 1): select
      .mockReturnValueOnce(chain({ data: { name: 'Librarian', description: null }, error: null })) // cloneRole: select
      .mockReturnValueOnce(chain({ data: newRole, error: null })) // cloneRole: insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert (ROLE)
      .mockReturnValueOnce(chain({ data: null, error: null })) // roles update bump
      .mockReturnValueOnce(chain({ data: newTask, error: null })) // cloneTask (step 1): insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert (TASK)
      .mockReturnValueOnce(chain({ data: null, error: null })) // tasks update bump
      .mockReturnValueOnce(chain({ data: null, error: null })) // workflow_steps insert (step 1)
      // step 2 references the same source task-1 -> cloneTask dedup hit, zero extra from() calls
      .mockReturnValueOnce(chain({ data: null, error: null })) // workflow_steps insert (step 2)
      .mockReturnValueOnce(chain({ data: newSteps, error: null })) // loadSteps (new workflow, for the final snapshot)
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert (WORKFLOW)
      .mockReturnValueOnce(chain({ data: null, error: null })) // workflows update bump
      .mockReturnValueOnce(chain({ data: null, error: null })) // clone_records insert
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/WORKFLOW/wf-1',
      { method: 'POST', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ cloned: { item_type: string; id: string } }>()

    expect(res.status).toBe(201)
    expect(body.cloned).toEqual({ item_type: 'WORKFLOW', id: 'wf-2' })
    // Only one Task row inserted for the two steps that both reference task-1.
    expect(fromMock.mock.calls.filter((call) => call[0] === 'tasks')).toHaveLength(3)
    expect(fromMock.mock.calls.filter((call) => call[0] === 'workflow_steps')).toHaveLength(4)
    // One snapshot each for the cloned Role, the deduped Task, and the
    // Workflow itself — exactly one v1 Workflow snapshot, not one per step.
    expect(fromMock.mock.calls.filter((call) => call[0] === 'version_snapshots')).toHaveLength(3)
  })

  it('GET /:itemType/:id returns null provenance for a never-cloned item', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: null, error: null })) // clone_records lookup by cloned_item_id
      .mockReturnValueOnce(chain({ data: null, error: null, count: 0 })) // clone_records count
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/SKILL/skill-1',
      { headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ provenance: unknown; cloneCount: number }>()

    expect(res.status).toBe(200)
    expect(body).toEqual({ provenance: null, cloneCount: 0 })
  })

  it('GET /:itemType/:id resolves the source name/status via library_items for a cloned item', async () => {
    const cloneRecord = {
      source_item_type: 'SKILL',
      source_item_id: 'skill-1',
      cloned_at: '2026-01-01T00:00:00Z',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: cloneRecord, error: null })) // clone_records lookup
      .mockReturnValueOnce(chain({ data: { name: 'Shelver', status: 'Published' }, error: null })) // library_items lookup
      .mockReturnValueOnce(chain({ data: null, error: null, count: 3 })) // clone_records count
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/clone/SKILL/skill-2',
      { headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ provenance: Record<string, unknown> | null; cloneCount: number }>()

    expect(res.status).toBe(200)
    expect(body.cloneCount).toBe(3)
    expect(body.provenance).toEqual({
      source_item_type: 'SKILL',
      source_item_id: 'skill-1',
      source_name: 'Shelver',
      source_status: 'Published',
      cloned_at: '2026-01-01T00:00:00Z',
    })
  })
})
