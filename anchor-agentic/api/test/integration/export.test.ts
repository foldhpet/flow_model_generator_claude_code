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

function postExport(body: unknown) {
  const app = createApp()
  return app.request(
    '/api/v1/export',
    { method: 'POST', headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    testEnv,
  )
}

interface ExportFile {
  path: string
  content: string
}

describe('export route', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const res = await postExport({ item_type: 'AGENT', item_id: 'agent-1' })
    expect(res.status).toBe(401)
  })

  it('400s an invalid item_type', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const res = await postExport({ item_type: 'ROLE', item_id: 'role-1' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it('400s a missing item_id', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const res = await postExport({ item_type: 'AGENT' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('item_id_required')
  })

  it('400s an invalid target', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const res = await postExport({ item_type: 'AGENT', item_id: 'agent-1', target: 'bogus' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_target')
  })

  it('400s target "github" when github_repo is missing', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const res = await postExport({ item_type: 'WORKFLOW', item_id: 'wf-1', target: 'github' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('github_repo_required')
  })

  it('409s target "github" when user has no GitHub credentials (not connected)', async () => {
    // Mock two sequential github_credentials selects
    const fromMock = vi.fn()
    // First call: github_credentials select returns null (no credentials)
    fromMock.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })

    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await postExport({ item_type: 'AGENT', item_id: 'agent-1', target: 'github', github_repo: 'owner/repo' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(409)
    expect(body.error).toBe('github_not_connected')
  })

  it('404s an unknown item', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const res = await postExport({ item_type: 'AGENT', item_id: 'missing' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('403s a Draft item owned by someone else', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'agent-1', owner_id: 'someone-else', role_id: 'role-1', status: 'Draft' }, error: null }),
      ),
    )

    const res = await postExport({ item_type: 'AGENT', item_id: 'agent-1' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('exports a Draft Agent the caller owns: role frontmatter plus an Abilities section', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: { id: 'agent-1', owner_id: USER_ID, role_id: 'role-1', system_prompt: 'Be helpful', status: 'Draft' },
          error: null,
        }),
      ) // agents select
      .mockReturnValueOnce(chain({ data: { name: 'Librarian', description: 'Sorts and shelves.' }, error: null })) // roles select
      .mockReturnValueOnce(
        chain({ data: [{ tasks: { name: 'Shelve books', instructions: 'Alphabetical order.' } }], error: null }),
      ) // agent_tasks select
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await postExport({ item_type: 'AGENT', item_id: 'agent-1' })
    const body = await res.json<{ files: ExportFile[] }>()

    expect(res.status).toBe(200)
    expect(body.files).toHaveLength(1)
    expect(body.files[0].path).toBe('.claude/agents/librarian-agent-1.md')
    expect(body.files[0].content).toContain('description: "Sorts and shelves."')
    expect(body.files[0].content).toContain('Be helpful')
    expect(body.files[0].content).toContain('### Shelve books')
    expect(body.files[0].content).toContain('Alphabetical order.')
  })

  it('another owner may export a Published Agent (read-shared, not write-shared)', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({
          data: {
            id: 'agent-1',
            owner_id: 'someone-else',
            role_id: 'role-1',
            system_prompt: 'Be helpful',
            status: 'Published',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(chain({ data: { name: 'Librarian', description: null }, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await postExport({ item_type: 'AGENT', item_id: 'agent-1' })
    expect(res.status).toBe(200)
  })

  it('exports a Skill: one file per skill_files row, byte-for-byte', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({
          data: {
            id: 'skill-1',
            owner_id: USER_ID,
            name: 'Checklist',
            skill_files: [{ path: 'SKILL.md', content: '# Checklist' }],
            status: 'Draft',
          },
          error: null,
        }),
      ),
    )

    const res = await postExport({ item_type: 'SKILL', item_id: 'skill-1' })
    const body = await res.json<{ files: ExportFile[] }>()

    expect(res.status).toBe(200)
    expect(body.files).toEqual([{ path: '.claude/skills/checklist-skill-1/SKILL.md', content: '# Checklist' }])
  })

  it('400s dangling_step_reference when a Workflow step references an Archived Task', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: USER_ID, name: 'Flow', status: 'Draft' }, error: null })) // workflows select
      .mockReturnValueOnce(
        chain({
          data: [{ order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null }],
          error: null,
        }),
      ) // workflow_steps select
      .mockReturnValueOnce(chain({ data: [{ id: 'task-1', name: 'x', instructions: 'y', status: 'Archived' }], error: null })) // tasks lookup
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await postExport({ item_type: 'WORKFLOW', item_id: 'wf-1' })
    const body = await res.json<{ error: string; steps: number[] }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('dangling_step_reference')
    expect(body.steps).toEqual([0])
  })

  it('exports a Workflow: steps in order, TASK inlined, AGENT/SKILL cross-referenced', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'wf-1', owner_id: USER_ID, name: 'Cataloging Flow', status: 'Draft' }, error: null }),
      ) // workflows select
      .mockReturnValueOnce(
        chain({
          data: [
            { order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null },
            { order_index: 1, step_type: 'AGENT', task_id: null, agent_id: 'agent-1', skill_id: null },
            { order_index: 2, step_type: 'SKILL', task_id: null, agent_id: null, skill_id: 'skill-1' },
          ],
          error: null,
        }),
      ) // workflow_steps select
      .mockReturnValueOnce(
        chain({ data: [{ id: 'task-1', name: 'Sort shelf', instructions: 'Alphabetize.', status: 'Published' }], error: null }),
      ) // tasks lookup
      .mockReturnValueOnce(chain({ data: [{ id: 'agent-1', role_id: 'role-1', status: 'Published' }], error: null })) // agents lookup
      .mockReturnValueOnce(chain({ data: [{ id: 'role-1', name: 'Librarian' }], error: null })) // roles lookup
      .mockReturnValueOnce(chain({ data: [{ id: 'skill-1', name: 'Barcode Lookup', status: 'Published' }], error: null })) // skills lookup
      // Phase 3 bundling: additional mocks for fetching full Agent+Skill data to bundle them
      .mockReturnValueOnce(
        chain({
          data: { id: 'agent-1', owner_id: USER_ID, role_id: 'role-1', system_prompt: 'Catalog books.', status: 'Published' },
          error: null,
        }),
      ) // agents select for bundling
      .mockReturnValueOnce(chain({ data: { id: 'role-1', name: 'Librarian', description: null }, error: null })) // roles select for bundling
      .mockReturnValueOnce(
        chain({
          data: [{ tasks: { name: 'Index books', instructions: 'Use Dewey.' } }],
          error: null,
        }),
      ) // agent_tasks select for bundling
      .mockReturnValueOnce(
        chain({
          data: { id: 'skill-1', name: 'Barcode Lookup', skill_files: [{ path: 'SKILL.md', content: '# Lookup' }] },
          error: null,
        }),
      ) // skills select for bundling
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const res = await postExport({ item_type: 'WORKFLOW', item_id: 'wf-1' })
    const body = await res.json<{ files: ExportFile[] }>()

    expect(res.status).toBe(200)
    // Bundled export: Workflow command file + Agent file + Skill file (3 total)
    expect(body.files).toHaveLength(3)
    expect(body.files.some((f) => f.path.startsWith('.claude/commands/'))).toBe(true)
    expect(body.files.some((f) => f.path.startsWith('.claude/agents/'))).toBe(true)
    expect(body.files.some((f) => f.path.startsWith('.claude/skills/'))).toBe(true)

    const commandFile = body.files.find((f) => f.path.startsWith('.claude/commands/'))!
    const content = commandFile.content
    expect(content).toContain('Sort shelf') // Inlined task
    expect(content).toContain('Alphabetize.')
    expect(content).toContain('Agent for Librarian') // Cross-reference (but no "must be exported separately" note since we bundled it)
    expect(content).toContain('Skill: Barcode Lookup')
  })
})
