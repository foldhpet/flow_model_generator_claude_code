import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { createRequestSupabaseClient } from '../supabase'

export const marketplaceRouter = new Hono<AppEnv>()

// Public reads only — no requireAuth. Anonymous browsing is a product
// requirement (US-026 AC1); RLS on the underlying tables (inherited via the
// view's security_invoker) is what actually enforces "Published only", not
// this router.
const MARKETPLACE_ITEM_TYPES = ['AGENT', 'SKILL', 'WORKFLOW'] as const
type MarketplaceItemType = (typeof MARKETPLACE_ITEM_TYPES)[number]

function parsePage(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

type WorkflowStepRow = {
  id: string
  order_index: number
  step_type: 'TASK' | 'AGENT' | 'SKILL'
  task_id: string | null
  agent_id: string | null
  skill_id: string | null
}

// US-027 AC3: resolves each frozen step's referenced Task/Agent/Skill to a
// human-readable label via batched, ids-only lookups against the *live*
// tables — mirrors workflows/[id]/+page.server.ts's describeStep, scoped
// down to just the ids this Workflow's steps actually reference.
async function resolveStepLabels(supabase: ReturnType<typeof createRequestSupabaseClient>, steps: WorkflowStepRow[]) {
  const taskIds = steps.filter((s) => s.step_type === 'TASK' && s.task_id).map((s) => s.task_id as string)
  const agentIds = steps.filter((s) => s.step_type === 'AGENT' && s.agent_id).map((s) => s.agent_id as string)
  const skillIds = steps.filter((s) => s.step_type === 'SKILL' && s.skill_id).map((s) => s.skill_id as string)

  const taskById = new Map<string, { id: string; name: string }>()
  const agentById = new Map<string, { id: string; role_id: string }>()
  const skillById = new Map<string, { id: string; name: string }>()
  const roleById = new Map<string, { id: string; name: string }>()

  if (taskIds.length > 0) {
    const { data, error } = await supabase.from('tasks').select('id, name').in('id', taskIds)
    if (error) throw error
    for (const row of data ?? []) taskById.set(row.id, row)
  }

  if (agentIds.length > 0) {
    const { data, error } = await supabase.from('agents').select('id, role_id').in('id', agentIds)
    if (error) throw error
    for (const row of data ?? []) agentById.set(row.id, row)

    const roleIds = [...new Set((data ?? []).map((row) => row.role_id))]
    if (roleIds.length > 0) {
      const { data: roles, error: rolesError } = await supabase.from('roles').select('id, name').in('id', roleIds)
      if (rolesError) throw rolesError
      for (const row of roles ?? []) roleById.set(row.id, row)
    }
  }

  if (skillIds.length > 0) {
    const { data, error } = await supabase.from('skills').select('id, name').in('id', skillIds)
    if (error) throw error
    for (const row of data ?? []) skillById.set(row.id, row)
  }

  return steps.map((step) => {
    let label = ''
    if (step.step_type === 'TASK' && step.task_id) label = taskById.get(step.task_id)?.name ?? step.task_id
    else if (step.step_type === 'AGENT' && step.agent_id) {
      const agent = agentById.get(step.agent_id)
      label = agent ? `Agent for ${roleById.get(agent.role_id)?.name ?? agent.role_id}` : step.agent_id
    } else if (step.step_type === 'SKILL' && step.skill_id) label = skillById.get(step.skill_id)?.name ?? step.skill_id
    return { ...step, label }
  })
}

// US-026/US-028: search/filter/paginate over the frozen, Published-only
// marketplace_items view. "Highest rated" has no rating data to sort by
// yet, so the primary order is clone_count desc — exactly the AC's own
// documented tiebreak, just promoted since every item currently ties at 0.
marketplaceRouter.get('/items', async (c) => {
  const supabase = createRequestSupabaseClient(c)
  const type = c.req.query('type')
  const role = c.req.query('role')
  const q = c.req.query('q')
  const page = parsePage(c.req.query('page'), 1)
  const pageSize = parsePage(c.req.query('pageSize'), 20)

  let query = supabase
    .from('marketplace_items')
    .select(
      'item_type, id, owner_id, name, description, role_id, role_name, published_version, clone_count, created_at, updated_at, rating, rating_count',
      { count: 'exact' },
    )
    .order('clone_count', { ascending: false })
    .order('created_at', { ascending: false })

  if (type && (MARKETPLACE_ITEM_TYPES as readonly string[]).includes(type)) {
    query = query.eq('item_type', type as MarketplaceItemType)
  }
  if (role && role.trim()) query = query.eq('role_name', role.trim())
  if (q && q.trim()) query = query.textSearch('search_text', q.trim(), { type: 'plain' })

  const from = (page - 1) * pageSize
  const { data, error, count } = await query.range(from, from + pageSize - 1)
  if (error) throw error

  return c.json({ items: data ?? [], total: count ?? 0, page, pageSize })
})

// US-027: detail lookup plus type-specific live extras (Agent task
// assignments, Workflow step labels) that were never part of the frozen
// snapshot in the first place.
marketplaceRouter.get('/items/:itemType/:id', async (c) => {
  const itemType = c.req.param('itemType')
  if (!(MARKETPLACE_ITEM_TYPES as readonly string[]).includes(itemType)) {
    return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  }

  const supabase = createRequestSupabaseClient(c)
  const id = c.req.param('id')

  const { data: item, error } = await supabase
    .from('marketplace_items')
    .select('*')
    .eq('item_type', itemType)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  // Never distinguishes "doesn't exist" from "not Published" (US-027 AC5) —
  // the view itself already excludes anything not Published.
  if (!item) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)

  const extras: Record<string, unknown> = {}

  if (itemType === 'AGENT') {
    const { data: assignments, error: assignError } = await supabase
      .from('agent_tasks')
      .select('id, task_id, tasks(id, name, status)')
      .eq('agent_id', id)
    if (assignError) throw assignError
    extras.assignments = assignments ?? []
  }

  if (itemType === 'WORKFLOW') {
    extras.steps = await resolveStepLabels(supabase, (item.steps as WorkflowStepRow[] | null) ?? [])
  }

  // US-032 AC3: a soft auth check (not requireAuth — anonymous detail reads
  // must keep working per US-026 AC1) so a registered rater's own score is
  // included without a separate round trip from the web layer.
  let myRating: number | null = null
  const { data: userData } = await supabase.auth.getUser()
  if (userData.user) {
    const { data: own, error: ownError } = await supabase
      .from('ratings')
      .select('score')
      .eq('item_type', itemType)
      .eq('item_id', id)
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (ownError) throw ownError
    myRating = own?.score ?? null
  }

  return c.json({ item, ...extras, myRating })
})
