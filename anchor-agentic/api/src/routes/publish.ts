import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'
import { recordVersionSnapshot } from '../versioning'
import { findDanglingSteps, isAgentPublishReady, isSkillPublishReady } from '../publishValidation'

export const publishRouter = new Hono<AppEnv>()

publishRouter.use('*', requireAuth)

type PublishItemType = 'AGENT' | 'SKILL' | 'WORKFLOW'

const PUBLISH_ITEM_TYPES: PublishItemType[] = ['AGENT', 'SKILL', 'WORKFLOW']

const TABLE: Record<PublishItemType, string> = {
  AGENT: 'agents',
  SKILL: 'skills',
  WORKFLOW: 'workflows',
}

const COLUMNS: Record<PublishItemType, string> = {
  AGENT: 'id, owner_id, role_id, system_prompt, status, current_version, published_version, created_at, updated_at',
  SKILL:
    'id, owner_id, name, description, skill_files, status, current_version, published_version, created_at, updated_at',
  WORKFLOW: 'id, owner_id, name, description, status, current_version, published_version, created_at, updated_at',
}

const STEP_COLUMNS = 'id, workflow_id, order_index, step_type, task_id, agent_id, skill_id, created_at'

// US-023/US-024/US-025: the sole way any item reaches Published. Runs
// structural completeness checks (US-024), then bumps current_version,
// records a snapshot (same choke point as every other mutation), and
// freezes published_version to that new version (US-025's "v_public").
// Only AGENT/SKILL/WORKFLOW are publishable — Role/Task have no route here
// at all, and the generic PATCH path independently rejects a direct
// Published transition (lifecycle.ts).
publishRouter.post('/:itemType/:id', async (c) => {
  const itemType = c.req.param('itemType') as PublishItemType
  if (!PUBLISH_ITEM_TYPES.includes(itemType)) {
    return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const userId = c.get('userId')!
  const id = c.req.param('id')

  const { data: item, error } = await supabase.from(TABLE[itemType]).select(COLUMNS[itemType]).eq('id', id).maybeSingle()
  if (error) throw error
  if (!item) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)

  if (item.owner_id !== userId) {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }

  if (item.status === 'Archived' || item.status === 'Removed') {
    return c.json({ error: 'item_not_publishable_from_current_status', requestId: c.get('requestId') }, 400)
  }

  if (itemType === 'AGENT' && !isAgentPublishReady(item)) {
    return c.json({ error: 'empty_system_prompt', requestId: c.get('requestId') }, 400)
  }

  if (itemType === 'SKILL' && !isSkillPublishReady(item)) {
    return c.json({ error: 'skill_has_no_files', requestId: c.get('requestId') }, 400)
  }

  let workflowSteps: unknown[] = []
  if (itemType === 'WORKFLOW') {
    const { data: steps, error: stepsError } = await supabase
      .from('workflow_steps')
      .select(STEP_COLUMNS)
      .eq('workflow_id', id)
      .order('order_index', { ascending: true })
    if (stepsError) throw stepsError
    workflowSteps = steps ?? []
    if (!steps || steps.length === 0) {
      return c.json({ error: 'workflow_has_no_steps', requestId: c.get('requestId') }, 400)
    }

    const statusById = new Map<string, string>()
    const idsByTable: Record<'tasks' | 'agents' | 'skills', string[]> = { tasks: [], agents: [], skills: [] }
    for (const step of steps) {
      if (step.step_type === 'TASK' && step.task_id) idsByTable.tasks.push(step.task_id)
      if (step.step_type === 'AGENT' && step.agent_id) idsByTable.agents.push(step.agent_id)
      if (step.step_type === 'SKILL' && step.skill_id) idsByTable.skills.push(step.skill_id)
    }
    for (const table of ['tasks', 'agents', 'skills'] as const) {
      const ids = idsByTable[table]
      if (ids.length === 0) continue
      const { data: rows, error: refError } = await supabase.from(table).select('id, status').in('id', ids)
      if (refError) throw refError
      for (const row of rows ?? []) statusById.set(row.id, row.status)
    }

    const refs = steps.map((s) => ({
      order_index: s.order_index,
      ref_id: (s.task_id ?? s.agent_id ?? s.skill_id) as string,
    }))
    const dangling = findDanglingSteps(refs, statusById)
    if (dangling.length > 0) {
      return c.json(
        {
          error: 'dangling_step_reference',
          requestId: c.get('requestId'),
          steps: dangling.map((d) => d.order_index),
        },
        400,
      )
    }
  }

  const newVersion = item.current_version + 1
  const patch = {
    status: 'Published',
    current_version: newVersion,
    published_version: newVersion,
    updated_at: new Date().toISOString(),
  }

  const { data: updated, error: updateError } = await supabase
    .from(TABLE[itemType])
    .update(patch)
    .eq('id', id)
    .select(COLUMNS[itemType])
    .single()
  if (updateError) throw updateError

  const snapshotData = itemType === 'WORKFLOW' ? { ...updated, steps: workflowSteps } : updated
  await recordVersionSnapshot(supabase, itemType, id, newVersion, snapshotData, userId)

  return c.json({ published: { item_type: itemType, id, version: newVersion } })
})
