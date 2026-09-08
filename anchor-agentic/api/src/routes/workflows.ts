import { Hono } from 'hono'
import type { Context } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'
import { recordVersionSnapshot } from '../versioning'
import { validateStatusTransition } from '../lifecycle'
import { hasExactlyOneReference, renumber } from '../workflowSteps'

export const workflowsRouter = new Hono<AppEnv>()

workflowsRouter.use('*', requireAuth)

const WORKFLOW_COLUMNS =
  'id, owner_id, name, description, status, current_version, published_version, created_at, updated_at'
const STEP_COLUMNS = 'id, workflow_id, order_index, step_type, task_id, agent_id, skill_id, created_at'

workflowsRouter.get('/', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('workflows')
    .select(WORKFLOW_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return c.json({ workflows: data ?? [] })
})

workflowsRouter.get('/:id', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('workflows')
    .select(WORKFLOW_COLUMNS)
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) throw error
  if (!data) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  return c.json({ workflow: data })
})

// US-010: Workflows start empty — steps are added one at a time below.
workflowsRouter.post('/', async (c) => {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return c.json({ error: 'invalid_name', requestId: c.get('requestId') }, 400)

  const description = typeof body?.description === 'string' ? body.description : null
  const { data, error } = await supabase
    .from('workflows')
    .insert({ name, description, owner_id: userId })
    .select(WORKFLOW_COLUMNS)
    .single()
  if (error) throw error

  await recordVersionSnapshot(supabase, 'WORKFLOW', data.id, 1, { ...data, steps: [] }, userId!)
  return c.json({ workflow: data }, 201)
})

async function checkOwnership(c: Context<AppEnv>, id: string) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const { data, error } = await supabase
    .from('workflows')
    .select('id, owner_id, status, current_version')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return { result: 'not_found' as const, workflow: null }
  if (data.owner_id !== userId) return { result: 'forbidden' as const, workflow: null }
  return { result: 'ok' as const, workflow: data }
}

workflowsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const ownership = await checkOwnership(c, id)
  if (ownership.result === 'not_found') {
    return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  }
  if (ownership.result === 'forbidden') {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }

  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)

  const nextStatus = typeof body?.status === 'string' ? body.status : undefined
  const transitionError = validateStatusTransition(ownership.workflow!.status, nextStatus)
  if (transitionError) return c.json({ error: transitionError, requestId: c.get('requestId') }, 400)

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.name === 'string') {
    const name = body.name.trim()
    if (!name) return c.json({ error: 'invalid_name', requestId: c.get('requestId') }, 400)
    patch.name = name
  }
  if (typeof body?.description === 'string') patch.description = body.description
  if (nextStatus !== undefined) patch.status = nextStatus

  patch.current_version = ownership.workflow!.current_version + 1

  const { data, error } = await supabase
    .from('workflows')
    .update(patch)
    .eq('id', id)
    .select(WORKFLOW_COLUMNS)
    .single()
  if (error) throw error

  const steps = await loadSteps(supabase, id)
  await recordVersionSnapshot(supabase, 'WORKFLOW', id, patch.current_version as number, { ...data, steps }, userId!)
  return c.json({ workflow: data })
})

async function loadSteps(supabase: SupabaseClient, workflowId: string) {
  const { data, error } = await supabase
    .from('workflow_steps')
    .select(STEP_COLUMNS)
    .eq('workflow_id', workflowId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data ?? []
}

workflowsRouter.get('/:id/steps', async (c) => {
  const steps = await loadSteps(c.get('supabase'), c.req.param('id'))
  return c.json({ steps })
})

// A caller may reference their own item in any status, or another owner's
// item only once it's Published (US-010/US-011 — Workflows can only wire in
// finished, shareable work from outside the caller's own Sandbox).
async function canReference(
  supabase: SupabaseClient,
  userId: string,
  table: 'tasks' | 'agents' | 'skills',
  id: string,
) {
  const { data, error } = await supabase.from(table).select('id, owner_id, status').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return false
  if (data.owner_id === userId) return true
  return data.status === 'Published'
}

function referenceTable(stepType: string): 'tasks' | 'agents' | 'skills' | null {
  if (stepType === 'TASK') return 'tasks'
  if (stepType === 'AGENT') return 'agents'
  if (stepType === 'SKILL') return 'skills'
  return null
}

// Two-phase renumber: first push every affected row to a distinct negative
// order_index, then assign the final 0..n-1 values. This avoids tripping the
// unique(workflow_id, order_index) constraint mid-sequence, since Postgres
// enforces it immediately (not deferred) and a naive single-pass renumber
// can momentarily collide with a row that hasn't moved yet.
async function renumberSteps(supabase: SupabaseClient, orderedStepIds: string[]) {
  const targets = renumber(orderedStepIds)
  for (const { id, order_index } of targets) {
    const { error } = await supabase.from('workflow_steps').update({ order_index: -(order_index + 1) }).eq('id', id)
    if (error) throw error
  }
  for (const { id, order_index } of targets) {
    const { error } = await supabase.from('workflow_steps').update({ order_index }).eq('id', id)
    if (error) throw error
  }
}

async function bumpAndSnapshot(c: Context<AppEnv>, id: string, workflow: { current_version: number }) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const nextVersion = workflow.current_version + 1
  const { data, error } = await supabase
    .from('workflows')
    .update({ current_version: nextVersion, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(WORKFLOW_COLUMNS)
    .single()
  if (error) throw error
  const steps = await loadSteps(supabase, id)
  await recordVersionSnapshot(supabase, 'WORKFLOW', id, nextVersion, { ...data, steps }, userId!)
  return { workflow: data, steps }
}

// US-010/US-012: append a step, server-assigned order_index, exactly one
// reference matching step_type, and only referencing an allowed item.
workflowsRouter.post('/:id/steps', async (c) => {
  const workflowId = c.req.param('id')
  const ownership = await checkOwnership(c, workflowId)
  if (ownership.result === 'not_found') {
    return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  }
  if (ownership.result === 'forbidden') {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }
  if (ownership.workflow!.status === 'Archived') {
    return c.json({ error: 'archived_item_is_terminal', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const ref = {
    step_type: typeof body?.step_type === 'string' ? body.step_type : '',
    task_id: typeof body?.task_id === 'string' ? body.task_id : null,
    agent_id: typeof body?.agent_id === 'string' ? body.agent_id : null,
    skill_id: typeof body?.skill_id === 'string' ? body.skill_id : null,
  }
  if (!hasExactlyOneReference(ref)) {
    return c.json({ error: 'invalid_reference', requestId: c.get('requestId') }, 400)
  }

  const table = referenceTable(ref.step_type)!
  const referencedId = (ref.task_id ?? ref.agent_id ?? ref.skill_id)!
  if (!(await canReference(supabase, userId!, table, referencedId))) {
    return c.json({ error: 'reference_not_allowed', requestId: c.get('requestId') }, 400)
  }

  const existingSteps = await loadSteps(supabase, workflowId)
  const { error: insertError } = await supabase.from('workflow_steps').insert({
    workflow_id: workflowId,
    order_index: existingSteps.length,
    step_type: ref.step_type,
    task_id: ref.task_id,
    agent_id: ref.agent_id,
    skill_id: ref.skill_id,
  })
  if (insertError) throw insertError

  const { workflow, steps } = await bumpAndSnapshot(c, workflowId, ownership.workflow!)
  return c.json({ workflow, steps }, 201)
})

// US-011/US-012: edit a step's type/reference in place; order_index is untouched.
workflowsRouter.patch('/:id/steps/:stepId', async (c) => {
  const workflowId = c.req.param('id')
  const stepId = c.req.param('stepId')
  const ownership = await checkOwnership(c, workflowId)
  if (ownership.result === 'not_found') {
    return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  }
  if (ownership.result === 'forbidden') {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }
  if (ownership.workflow!.status === 'Archived') {
    return c.json({ error: 'archived_item_is_terminal', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const { data: existingStep, error: stepError } = await supabase
    .from('workflow_steps')
    .select(STEP_COLUMNS)
    .eq('id', stepId)
    .eq('workflow_id', workflowId)
    .maybeSingle()
  if (stepError) throw stepError
  if (!existingStep) return c.json({ error: 'step_not_found', requestId: c.get('requestId') }, 404)

  const body = await c.req.json().catch(() => null)
  const ref = {
    step_type: typeof body?.step_type === 'string' ? body.step_type : existingStep.step_type,
    task_id: typeof body?.task_id === 'string' ? body.task_id : null,
    agent_id: typeof body?.agent_id === 'string' ? body.agent_id : null,
    skill_id: typeof body?.skill_id === 'string' ? body.skill_id : null,
  }
  if (!hasExactlyOneReference(ref)) {
    return c.json({ error: 'invalid_reference', requestId: c.get('requestId') }, 400)
  }

  const table = referenceTable(ref.step_type)!
  const referencedId = (ref.task_id ?? ref.agent_id ?? ref.skill_id)!
  if (!(await canReference(supabase, userId!, table, referencedId))) {
    return c.json({ error: 'reference_not_allowed', requestId: c.get('requestId') }, 400)
  }

  const { error: updateError } = await supabase
    .from('workflow_steps')
    .update({
      step_type: ref.step_type,
      task_id: ref.task_id,
      agent_id: ref.agent_id,
      skill_id: ref.skill_id,
    })
    .eq('id', stepId)
  if (updateError) throw updateError

  const { workflow, steps } = await bumpAndSnapshot(c, workflowId, ownership.workflow!)
  return c.json({ workflow, steps })
})

// US-012: remove a step, then renumber the rest so order_index stays gapless.
workflowsRouter.delete('/:id/steps/:stepId', async (c) => {
  const workflowId = c.req.param('id')
  const stepId = c.req.param('stepId')
  const ownership = await checkOwnership(c, workflowId)
  if (ownership.result === 'not_found') {
    return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  }
  if (ownership.result === 'forbidden') {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }
  if (ownership.workflow!.status === 'Archived') {
    return c.json({ error: 'archived_item_is_terminal', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const existingSteps = await loadSteps(supabase, workflowId)
  if (!existingSteps.some((s) => s.id === stepId)) {
    return c.json({ error: 'step_not_found', requestId: c.get('requestId') }, 404)
  }

  const { error: deleteError } = await supabase.from('workflow_steps').delete().eq('id', stepId)
  if (deleteError) throw deleteError

  const remainingIds = existingSteps.filter((s) => s.id !== stepId).map((s) => s.id)
  await renumberSteps(supabase, remainingIds)

  const { workflow, steps } = await bumpAndSnapshot(c, workflowId, ownership.workflow!)
  return c.json({ workflow, steps })
})

// US-011: full reorder — body carries every existing step id in its new order.
workflowsRouter.put('/:id/steps/reorder', async (c) => {
  const workflowId = c.req.param('id')
  const ownership = await checkOwnership(c, workflowId)
  if (ownership.result === 'not_found') {
    return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  }
  if (ownership.result === 'forbidden') {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }
  if (ownership.workflow!.status === 'Archived') {
    return c.json({ error: 'archived_item_is_terminal', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const body = await c.req.json().catch(() => null)
  const stepIds = Array.isArray(body?.step_ids) ? body.step_ids.filter((id: unknown) => typeof id === 'string') : null
  if (!stepIds) return c.json({ error: 'invalid_step_ids', requestId: c.get('requestId') }, 400)

  const existingSteps = await loadSteps(supabase, workflowId)
  const existingIds = new Set(existingSteps.map((s) => s.id))
  const sameSet = stepIds.length === existingIds.size && stepIds.every((id: string) => existingIds.has(id))
  if (!sameSet) return c.json({ error: 'step_set_mismatch', requestId: c.get('requestId') }, 400)

  await renumberSteps(supabase, stepIds)

  const { workflow, steps } = await bumpAndSnapshot(c, workflowId, ownership.workflow!)
  return c.json({ workflow, steps })
})
