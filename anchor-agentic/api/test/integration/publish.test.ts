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

function post(path: string, body?: unknown) {
  const app = createApp()
  const headers: Record<string, string> = { Authorization: 'Bearer whatever' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return app.request(
    path,
    { method: 'POST', headers, body: body !== undefined ? JSON.stringify(body) : undefined },
    testEnv,
  )
}

const LONG_AGENT_PROMPT =
  'You are a Business Analyst agent. Draft user stories with clear acceptance criteria for each feature request.'
const LONG_SKILL_CONTENT =
  'Step one: gather requirements from the stakeholder and confirm scope boundaries clearly.'

describe('publish routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const res = await post('/api/v1/publish/AGENT/agent-1')
    expect(res.status).toBe(401)
  })

  it('400s an itemType of ROLE (Roles are never independently publishable)', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const res = await post('/api/v1/publish/ROLE/role-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it('400s an itemType of TASK', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const res = await post('/api/v1/publish/TASK/task-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it('404s an unknown item', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const res = await post('/api/v1/publish/AGENT/missing')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('403s a caller who does not own the item', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({
          data: { id: 'agent-1', owner_id: 'someone-else', system_prompt: 'x', status: 'Draft', current_version: 1 },
          error: null,
        }),
      ),
    )

    const res = await post('/api/v1/publish/AGENT/agent-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('400s item_not_publishable_from_current_status for an Archived item', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({
          data: { id: 'agent-1', owner_id: USER_ID, system_prompt: 'x', status: 'Archived', current_version: 1 },
          error: null,
        }),
      ),
    )

    const res = await post('/api/v1/publish/AGENT/agent-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('item_not_publishable_from_current_status')
  })

  it('400s empty_system_prompt for an Agent with no system_prompt', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({
          data: { id: 'agent-1', owner_id: USER_ID, system_prompt: null, status: 'Draft', current_version: 1 },
          error: null,
        }),
      ),
    )

    const res = await post('/api/v1/publish/AGENT/agent-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('empty_system_prompt')
  })

  it('400s skill_has_no_files for a Skill with an empty skill_files array', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({
          data: { id: 'skill-1', owner_id: USER_ID, skill_files: [], status: 'Draft', current_version: 1 },
          error: null,
        }),
      ),
    )

    const res = await post('/api/v1/publish/SKILL/skill-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('skill_has_no_files')
  })

  it('400s workflow_has_no_steps for a Workflow with zero steps', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'wf-1', owner_id: USER_ID, status: 'Draft', current_version: 1 }, error: null }),
      ) // workflows select
      .mockReturnValueOnce(chain({ data: [], error: null })) // workflow_steps select
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/WORKFLOW/wf-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('workflow_has_no_steps')
  })

  it('400s dangling_step_reference when a step references an Archived Task', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'wf-1', owner_id: USER_ID, status: 'Draft', current_version: 1 }, error: null }),
      ) // workflows select
      .mockReturnValueOnce(
        chain({
          data: [{ order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null }],
          error: null,
        }),
      ) // workflow_steps select
      .mockReturnValueOnce(chain({ data: [{ id: 'task-1', status: 'Archived' }], error: null })) // tasks status lookup
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/WORKFLOW/wf-1')
    const body = await res.json<{ error: string; steps: number[] }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('dangling_step_reference')
    expect(body.steps).toEqual([0])
  })

  it('400s dangling_step_reference when a step references a deleted item (missing status row)', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'wf-1', owner_id: USER_ID, status: 'Draft', current_version: 1 }, error: null }),
      ) // workflows select
      .mockReturnValueOnce(
        chain({
          data: [{ order_index: 0, step_type: 'SKILL', task_id: null, agent_id: null, skill_id: 'skill-gone' }],
          error: null,
        }),
      ) // workflow_steps select
      .mockReturnValueOnce(chain({ data: [], error: null })) // skills status lookup, empty -> missing
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/WORKFLOW/wf-1')
    const body = await res.json<{ error: string; steps: number[] }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('dangling_step_reference')
    expect(body.steps).toEqual([0])
  })

  it('publishes an Agent: bumps current_version, freezes published_version, records one snapshot', async () => {
    const updatedAgent = {
      id: 'agent-1',
      owner_id: USER_ID,
      role_id: 'role-1',
      system_prompt: LONG_AGENT_PROMPT,
      status: 'Published',
      current_version: 2,
      published_version: 2,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: { id: 'agent-1', owner_id: USER_ID, system_prompt: LONG_AGENT_PROMPT, status: 'Draft', current_version: 1 },
          error: null,
        }),
      ) // agents select
      .mockReturnValueOnce(chain({ data: null, error: null, count: 1 })) // agent_tasks select
      .mockReturnValueOnce(chain({ data: updatedAgent, error: null })) // agents update
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // agents update (version bump inside recordVersionSnapshot)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/AGENT/agent-1')
    const body = await res.json<{ published: { item_type: string; id: string; version: number } }>()

    expect(res.status).toBe(200)
    expect(body.published).toEqual({ item_type: 'AGENT', id: 'agent-1', version: 2 })
    expect(fromMock.mock.calls.filter((call) => call[0] === 'version_snapshots')).toHaveLength(1)
    expect(fromMock.mock.calls.filter((call) => call[0] === 'agents')).toHaveLength(3)
  })

  it('400s agent_has_no_tasks for an Agent with zero assigned tasks', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: { id: 'agent-1', owner_id: USER_ID, system_prompt: LONG_AGENT_PROMPT, status: 'Draft', current_version: 1 },
          error: null,
        }),
      ) // agents select
      .mockReturnValueOnce(chain({ data: null, error: null, count: 0 })) // agent_tasks select
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/AGENT/agent-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('agent_has_no_tasks')
  })

  it('400s quality_check_failed for an Agent whose system_prompt is too short', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: { id: 'agent-1', owner_id: USER_ID, system_prompt: 'Be helpful', status: 'Draft', current_version: 1 },
          error: null,
        }),
      ) // agents select
      .mockReturnValueOnce(chain({ data: null, error: null, count: 1 })) // agent_tasks select
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/AGENT/agent-1')
    const body = await res.json<{ error: string; issues: { code: string }[] }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('quality_check_failed')
    expect(body.issues.map((i) => i.code)).toContain('prompt_too_short')
  })

  it('requestReview: true submits the item for review instead of publishing, with no published_version bump', async () => {
    let capturedPatch: Record<string, unknown> | undefined
    const draftAgent = {
      id: 'agent-1',
      owner_id: USER_ID,
      system_prompt: LONG_AGENT_PROMPT,
      status: 'Draft',
      current_version: 1,
    }
    const reviewAgent = { ...draftAgent, status: 'UnderReview', current_version: 2 }

    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: draftAgent, error: null })) // agents select
      .mockReturnValueOnce(chain({ data: null, error: null, count: 1 })) // agent_tasks select
      .mockReturnValueOnce({
        update: (patch: Record<string, unknown>) => {
          capturedPatch = patch
          return chain({ data: reviewAgent, error: null })
        },
      }) // agents update
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // agents update (version bump inside recordVersionSnapshot)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/AGENT/agent-1', { requestReview: true })
    const body = await res.json<{ submittedForReview: { item_type: string; id: string; version: number } }>()

    expect(res.status).toBe(200)
    expect(body.submittedForReview).toEqual({ item_type: 'AGENT', id: 'agent-1', version: 2 })
    expect(capturedPatch).toMatchObject({ status: 'UnderReview', current_version: 2 })
    expect(capturedPatch).not.toHaveProperty('published_version')
  })

  it('re-publishing an already-Published item advances published_version to match current_version', async () => {
    const updatedSkill = {
      id: 'skill-1',
      owner_id: USER_ID,
      name: 'Shelver',
      description: null,
      skill_files: [{ path: 'SKILL.md', content: LONG_SKILL_CONTENT }],
      status: 'Published',
      current_version: 4,
      published_version: 4,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: {
            id: 'skill-1',
            owner_id: USER_ID,
            skill_files: [{ path: 'SKILL.md', content: LONG_SKILL_CONTENT }],
            status: 'Published',
            current_version: 3,
            published_version: 2,
          },
          error: null,
        }),
      ) // skills select — already Published at v2, current_version has moved to 3 since
      .mockReturnValueOnce(chain({ data: updatedSkill, error: null })) // skills update
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // skills update (version bump inside recordVersionSnapshot)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/SKILL/skill-1')
    const body = await res.json<{ published: { item_type: string; id: string; version: number } }>()

    expect(res.status).toBe(200)
    expect(body.published).toEqual({ item_type: 'SKILL', id: 'skill-1', version: 4 })
  })

  it('400s quality_check_failed for a Skill whose combined file content is too short', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({
          data: {
            id: 'skill-1',
            owner_id: USER_ID,
            skill_files: [{ path: 'SKILL.md', content: 'x' }],
            status: 'Draft',
            current_version: 1,
          },
          error: null,
        }),
      ),
    )

    const res = await post('/api/v1/publish/SKILL/skill-1')
    const body = await res.json<{ error: string; issues: { code: string }[] }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('quality_check_failed')
    expect(body.issues.map((i) => i.code)).toContain('prompt_too_short')
  })

  it('400s quality_check_failed for a Workflow whose description is too short', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: { id: 'wf-1', owner_id: USER_ID, description: 'short', status: 'Draft', current_version: 1 },
          error: null,
        }),
      ) // workflows select
      .mockReturnValueOnce(
        chain({
          data: [{ order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null }],
          error: null,
        }),
      ) // workflow_steps select
      .mockReturnValueOnce(chain({ data: [{ id: 'task-1', status: 'Published' }], error: null })) // tasks status lookup
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/WORKFLOW/wf-1')
    const body = await res.json<{ error: string; issues: { code: string }[] }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('quality_check_failed')
    expect(body.issues.map((i) => i.code)).toContain('prompt_too_short')
  })

  it('400s dangling_step_reference when a step references an UnderReview item', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'wf-1', owner_id: USER_ID, status: 'Draft', current_version: 1 }, error: null }),
      ) // workflows select
      .mockReturnValueOnce(
        chain({
          data: [{ order_index: 0, step_type: 'SKILL', task_id: null, agent_id: null, skill_id: 'skill-1' }],
          error: null,
        }),
      ) // workflow_steps select
      .mockReturnValueOnce(chain({ data: [{ id: 'skill-1', status: 'UnderReview' }], error: null })) // skills status lookup
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await post('/api/v1/publish/WORKFLOW/wf-1')
    const body = await res.json<{ error: string; steps: number[] }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('dangling_step_reference')
    expect(body.steps).toEqual([0])
  })
})
