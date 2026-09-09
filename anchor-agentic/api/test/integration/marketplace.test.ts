import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

function anonClient(fromImpl: (table: string) => ReturnType<typeof chain>) {
  return { from: vi.fn(fromImpl), auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) } }
}

// Wraps chain() to record the arguments passed to eq/textSearch/range so
// tests can prove a query param actually reaches the query, the same
// pattern tasks.test.ts uses for its role_id filter.
function capturingChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const builder = chain(result) as unknown as Record<string, (...args: unknown[]) => unknown>
  const calls: { eq: unknown[][]; textSearch: unknown[][]; range: unknown[][] } = { eq: [], textSearch: [], range: [] }
  const originalEq = builder.eq.bind(builder)
  builder.eq = (...args: unknown[]) => {
    calls.eq.push(args)
    return originalEq()
  }
  const originalTextSearch = builder.textSearch.bind(builder)
  builder.textSearch = (...args: unknown[]) => {
    calls.textSearch.push(args)
    return originalTextSearch()
  }
  const originalRange = builder.range.bind(builder)
  builder.range = (...args: unknown[]) => {
    calls.range.push(args)
    return originalRange()
  }
  return { builder, calls }
}

function get(path: string) {
  const app = createApp()
  return app.request(path, {}, testEnv)
}

describe('marketplace routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('GET /items returns an empty listing when nothing is Published yet', async () => {
    createRequestSupabaseClient.mockReturnValue(anonClient(() => chain({ data: [], error: null, count: 0 })))

    const res = await get('/api/v1/marketplace/items')
    const body = await res.json<{ items: unknown[]; total: number; page: number; pageSize: number }>()

    expect(res.status).toBe(200)
    expect(body).toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
  })

  it('GET /items returns Published rows shaped from the view, including the live rating aggregate', async () => {
    const rows = [
      {
        item_type: 'AGENT',
        id: 'agent-1',
        owner_id: 'owner-1',
        name: 'Test Analyst',
        description: 'Be diligent',
        role_id: 'role-1',
        role_name: 'Test Analyst',
        published_version: 1,
        clone_count: 3,
        created_at: 't',
        updated_at: 't',
        rating: 4.5,
        rating_count: 2,
      },
    ]
    createRequestSupabaseClient.mockReturnValue(anonClient(() => chain({ data: rows, error: null, count: 1 })))

    const res = await get('/api/v1/marketplace/items')
    const body = await res.json<{ items: unknown[]; total: number }>()

    expect(res.status).toBe(200)
    expect(body.items).toEqual(rows)
    expect(body.total).toBe(1)
  })

  it('GET /items applies the type filter when provided', async () => {
    const { builder, calls } = capturingChain({ data: [], error: null, count: 0 })
    createRequestSupabaseClient.mockReturnValue(anonClient(() => builder as ReturnType<typeof chain>))

    const res = await get('/api/v1/marketplace/items?type=SKILL')

    expect(res.status).toBe(200)
    expect(calls.eq).toContainEqual(['item_type', 'SKILL'])
  })

  it('GET /items ignores an unrecognized type value rather than erroring', async () => {
    const { builder, calls } = capturingChain({ data: [], error: null, count: 0 })
    createRequestSupabaseClient.mockReturnValue(anonClient(() => builder as ReturnType<typeof chain>))

    const res = await get('/api/v1/marketplace/items?type=ROLE')

    expect(res.status).toBe(200)
    expect(calls.eq.some(([col]) => col === 'item_type')).toBe(false)
  })

  it('GET /items applies the role filter (matches AGENT rows by role_name, per US-028 AC3)', async () => {
    const { builder, calls } = capturingChain({ data: [], error: null, count: 0 })
    createRequestSupabaseClient.mockReturnValue(anonClient(() => builder as ReturnType<typeof chain>))

    const res = await get('/api/v1/marketplace/items?role=Test+Analyst')

    expect(res.status).toBe(200)
    expect(calls.eq).toContainEqual(['role_name', 'Test Analyst'])
  })

  it('GET /items applies q as a plain-text search against search_text', async () => {
    const { builder, calls } = capturingChain({ data: [], error: null, count: 0 })
    createRequestSupabaseClient.mockReturnValue(anonClient(() => builder as ReturnType<typeof chain>))

    const res = await get('/api/v1/marketplace/items?q=shelve')

    expect(res.status).toBe(200)
    expect(calls.textSearch).toContainEqual(['search_text', 'shelve', { type: 'plain' }])
  })

  it('GET /items paginates using page/pageSize', async () => {
    const { builder, calls } = capturingChain({ data: [], error: null, count: 0 })
    createRequestSupabaseClient.mockReturnValue(anonClient(() => builder as ReturnType<typeof chain>))

    const res = await get('/api/v1/marketplace/items?page=3&pageSize=5')
    const body = await res.json<{ page: number; pageSize: number }>()

    expect(res.status).toBe(200)
    expect(body.page).toBe(3)
    expect(body.pageSize).toBe(5)
    expect(calls.range).toContainEqual([10, 14])
  })

  it('GET /items/:itemType/:id 400s an invalid itemType', async () => {
    createRequestSupabaseClient.mockReturnValue(anonClient(() => chain({ data: null, error: null })))

    const res = await get('/api/v1/marketplace/items/ROLE/role-1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it('GET /items/:itemType/:id 404s when the item does not exist or is not Published (undifferentiated)', async () => {
    createRequestSupabaseClient.mockReturnValue(anonClient(() => chain({ data: null, error: null })))

    const res = await get('/api/v1/marketplace/items/AGENT/missing')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('GET /items/AGENT/:id includes live task assignments alongside the frozen system_prompt', async () => {
    const item = {
      item_type: 'AGENT',
      id: 'agent-1',
      owner_id: 'owner-1',
      name: 'Test Analyst',
      description: 'Be diligent',
      role_id: 'role-1',
      role_name: 'Test Analyst',
      system_prompt: 'Be a diligent Test Analyst.',
      skill_files: null,
      steps: null,
      published_version: 1,
      clone_count: 0,
      created_at: 't',
      updated_at: 't',
      rating: null,
      rating_count: 0,
    }
    const assignments = [{ id: 'at-1', task_id: 'task-1', tasks: { id: 'task-1', name: 'Plan tests', status: 'Draft' } }]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: item, error: null })) // marketplace_items select
      .mockReturnValueOnce(chain({ data: assignments, error: null })) // agent_tasks select
    createRequestSupabaseClient.mockReturnValue({
      from: fromMock,
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    })

    const res = await get('/api/v1/marketplace/items/AGENT/agent-1')
    const body = await res.json<{ item: { rating: null; rating_count: number }; assignments: unknown; myRating: number | null }>()

    expect(res.status).toBe(200)
    expect(body.item).toEqual(item)
    expect(body.assignments).toEqual(assignments)
    expect(body.myRating).toBeNull()
  })

  it('GET /items/AGENT/:id includes the raters own score when a registered user is signed in', async () => {
    const item = {
      item_type: 'AGENT',
      id: 'agent-1',
      owner_id: 'owner-1',
      name: 'Test Analyst',
      description: 'Be diligent',
      role_id: 'role-1',
      role_name: 'Test Analyst',
      system_prompt: 'Be a diligent Test Analyst.',
      skill_files: null,
      steps: null,
      published_version: 1,
      clone_count: 0,
      created_at: 't',
      updated_at: 't',
      rating: 4,
      rating_count: 1,
    }
    const assignments: unknown[] = []
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: item, error: null })) // marketplace_items select
      .mockReturnValueOnce(chain({ data: assignments, error: null })) // agent_tasks select
      .mockReturnValueOnce(chain({ data: { score: 4 }, error: null })) // ratings select (own score)
    createRequestSupabaseClient.mockReturnValue({
      from: fromMock,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) },
    })

    const res = await get('/api/v1/marketplace/items/AGENT/agent-1')
    const body = await res.json<{ myRating: number | null }>()

    expect(res.status).toBe(200)
    expect(body.myRating).toBe(4)
  })

  it('GET /items/SKILL/:id includes the frozen skill_files', async () => {
    const item = {
      item_type: 'SKILL',
      id: 'skill-1',
      owner_id: 'owner-1',
      name: 'Shelver',
      description: 'Shelve things',
      role_id: null,
      role_name: null,
      system_prompt: null,
      skill_files: [{ path: 'SKILL.md', content: '# Shelver' }],
      steps: null,
      published_version: 1,
      clone_count: 0,
      created_at: 't',
      updated_at: 't',
    }
    createRequestSupabaseClient.mockReturnValue(anonClient(() => chain({ data: item, error: null })))

    const res = await get('/api/v1/marketplace/items/SKILL/skill-1')
    const body = await res.json<{ item: { skill_files: unknown } }>()

    expect(res.status).toBe(200)
    expect(body.item.skill_files).toEqual(item.skill_files)
  })

  it('GET /items/WORKFLOW/:id resolves each frozen step to a live label', async () => {
    const item = {
      item_type: 'WORKFLOW',
      id: 'wf-1',
      owner_id: 'owner-1',
      name: 'Cataloging Flow',
      description: 'Catalog things',
      role_id: null,
      role_name: null,
      system_prompt: null,
      skill_files: null,
      steps: [
        { id: 'step-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null },
        { id: 'step-2', order_index: 1, step_type: 'AGENT', task_id: null, agent_id: 'agent-1', skill_id: null },
        { id: 'step-3', order_index: 2, step_type: 'SKILL', task_id: null, agent_id: null, skill_id: 'skill-1' },
      ],
      published_version: 1,
      clone_count: 0,
      created_at: 't',
      updated_at: 't',
    }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: item, error: null })) // marketplace_items select
      .mockReturnValueOnce(chain({ data: [{ id: 'task-1', name: 'Plan tests' }], error: null })) // tasks lookup
      .mockReturnValueOnce(chain({ data: [{ id: 'agent-1', role_id: 'role-1' }], error: null })) // agents lookup
      .mockReturnValueOnce(chain({ data: [{ id: 'role-1', name: 'Test Analyst' }], error: null })) // roles lookup
      .mockReturnValueOnce(chain({ data: [{ id: 'skill-1', name: 'Shelver' }], error: null })) // skills lookup
    createRequestSupabaseClient.mockReturnValue({
      from: fromMock,
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    })

    const res = await get('/api/v1/marketplace/items/WORKFLOW/wf-1')
    const body = await res.json<{ steps: { label: string }[] }>()

    expect(res.status).toBe(200)
    expect(body.steps.map((s) => s.label)).toEqual(['Plan tests', 'Agent for Test Analyst', 'Shelver'])
  })
})
