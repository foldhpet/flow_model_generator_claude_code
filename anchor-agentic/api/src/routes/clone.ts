import { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { recordVersionSnapshot } from '../versioning'

export const cloneRouter = new Hono<AppEnv>()

cloneRouter.use('*', requireAuth)

type CloneItemType = 'AGENT' | 'SKILL' | 'WORKFLOW'
const CLONE_ITEM_TYPES: CloneItemType[] = ['AGENT', 'SKILL', 'WORKFLOW']

const ROLE_COLUMNS = 'id, owner_id, name, description, status, current_version, created_at, updated_at'
const TASK_COLUMNS = 'id, owner_id, role_id, name, instructions, status, current_version, created_at, updated_at'
const AGENT_COLUMNS = 'id, owner_id, role_id, system_prompt, status, current_version, created_at, updated_at'
const SKILL_COLUMNS =
  'id, owner_id, name, description, skill_files, status, current_version, created_at, updated_at'
const WORKFLOW_COLUMNS = 'id, owner_id, name, description, status, current_version, created_at, updated_at'
const STEP_COLUMNS = 'id, workflow_id, order_index, step_type, task_id, agent_id, skill_id, created_at'

type CloneMaps = {
  role: Map<string, string>
  task: Map<string, string>
  agent: Map<string, string>
  skill: Map<string, string>
}

function newMaps(): CloneMaps {
  return { role: new Map(), task: new Map(), agent: new Map(), skill: new Map() }
}

// US-022: cloning a Role/Task/Agent/Skill never shares rows with the source
// — every referenced entity in the graph gets a brand-new owned copy. Each
// helper dedupes by source id within a single clone call (via `maps`) so a
// Workflow with two steps pointing at the same Task only clones it once.

async function cloneRole(supabase: SupabaseClient, userId: string, sourceRoleId: string, maps: CloneMaps) {
  const existing = maps.role.get(sourceRoleId)
  if (existing) return existing

  const { data: role, error } = await supabase
    .from('roles')
    .select('name, description')
    .eq('id', sourceRoleId)
    .single()
  if (error) throw error

  const { data: newRole, error: insertError } = await supabase
    .from('roles')
    .insert({ name: role.name, description: role.description, owner_id: userId })
    .select(ROLE_COLUMNS)
    .single()
  if (insertError) throw insertError

  await recordVersionSnapshot(supabase, 'ROLE', newRole.id, 1, newRole, userId)
  maps.role.set(sourceRoleId, newRole.id)
  return newRole.id
}

async function cloneTask(supabase: SupabaseClient, userId: string, sourceTaskId: string, maps: CloneMaps) {
  const existing = maps.task.get(sourceTaskId)
  if (existing) return existing

  const { data: task, error } = await supabase
    .from('tasks')
    .select('name, instructions, role_id')
    .eq('id', sourceTaskId)
    .single()
  if (error) throw error

  const newRoleId = await cloneRole(supabase, userId, task.role_id, maps)

  const { data: newTask, error: insertError } = await supabase
    .from('tasks')
    .insert({ name: task.name, instructions: task.instructions, role_id: newRoleId, owner_id: userId })
    .select(TASK_COLUMNS)
    .single()
  if (insertError) throw insertError

  await recordVersionSnapshot(supabase, 'TASK', newTask.id, 1, newTask, userId)
  maps.task.set(sourceTaskId, newTask.id)
  return newTask.id
}

// US-022 AC1: an Agent clone duplicates its Role and every Task currently
// assigned to it (via agent_tasks), then rewires new AGENT_TASK rows to the
// new copies.
async function cloneAgent(supabase: SupabaseClient, userId: string, sourceAgentId: string, maps: CloneMaps) {
  const existing = maps.agent.get(sourceAgentId)
  if (existing) return existing

  const { data: agent, error } = await supabase
    .from('agents')
    .select('role_id, system_prompt')
    .eq('id', sourceAgentId)
    .single()
  if (error) throw error

  const { data: assignments, error: assignError } = await supabase
    .from('agent_tasks')
    .select('task_id')
    .eq('agent_id', sourceAgentId)
  if (assignError) throw assignError

  const newRoleId = await cloneRole(supabase, userId, agent.role_id, maps)

  const { data: newAgent, error: insertError } = await supabase
    .from('agents')
    .insert({ role_id: newRoleId, system_prompt: agent.system_prompt, owner_id: userId })
    .select(AGENT_COLUMNS)
    .single()
  if (insertError) throw insertError

  await recordVersionSnapshot(supabase, 'AGENT', newAgent.id, 1, newAgent, userId)
  maps.agent.set(sourceAgentId, newAgent.id)

  for (const assignment of assignments ?? []) {
    const newTaskId = await cloneTask(supabase, userId, assignment.task_id, maps)
    const { error: linkError } = await supabase
      .from('agent_tasks')
      .insert({ agent_id: newAgent.id, task_id: newTaskId })
    if (linkError) throw linkError
  }

  return newAgent.id
}

// US-022: a Skill is a leaf entity with no sub-references — clone creates
// exactly one new SKILL row.
async function cloneSkill(supabase: SupabaseClient, userId: string, sourceSkillId: string, maps: CloneMaps) {
  const existing = maps.skill.get(sourceSkillId)
  if (existing) return existing

  const { data: skill, error } = await supabase
    .from('skills')
    .select('name, description, skill_files')
    .eq('id', sourceSkillId)
    .single()
  if (error) throw error

  const { data: newSkill, error: insertError } = await supabase
    .from('skills')
    .insert({ name: skill.name, description: skill.description, skill_files: skill.skill_files, owner_id: userId })
    .select(SKILL_COLUMNS)
    .single()
  if (insertError) throw insertError

  await recordVersionSnapshot(supabase, 'SKILL', newSkill.id, 1, newSkill, userId)
  maps.skill.set(sourceSkillId, newSkill.id)
  return newSkill.id
}

async function loadSteps(supabase: SupabaseClient, workflowId: string) {
  const { data, error } = await supabase
    .from('workflow_steps')
    .select(STEP_COLUMNS)
    .eq('workflow_id', workflowId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data ?? []
}

// US-022 AC2: a Workflow clone duplicates the full referenced graph (Roles,
// Tasks, Agents, Skills as needed across every step — regardless of who
// owned the original reference, canReference in workflows.ts already allows
// a step to point at another owner's Published item) and rewires new
// WORKFLOW_STEP rows to the new copies, never the originals.
async function cloneWorkflow(supabase: SupabaseClient, userId: string, sourceWorkflowId: string) {
  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('name, description')
    .eq('id', sourceWorkflowId)
    .single()
  if (error) throw error

  const sourceSteps = await loadSteps(supabase, sourceWorkflowId)

  const { data: newWorkflow, error: insertError } = await supabase
    .from('workflows')
    .insert({ name: workflow.name, description: workflow.description, owner_id: userId })
    .select(WORKFLOW_COLUMNS)
    .single()
  if (insertError) throw insertError

  const maps = newMaps()
  for (const step of sourceSteps) {
    const stepInsert: Record<string, unknown> = {
      workflow_id: newWorkflow.id,
      order_index: step.order_index,
      step_type: step.step_type,
      task_id: null,
      agent_id: null,
      skill_id: null,
    }
    if (step.step_type === 'TASK') {
      stepInsert.task_id = await cloneTask(supabase, userId, step.task_id, maps)
    } else if (step.step_type === 'AGENT') {
      stepInsert.agent_id = await cloneAgent(supabase, userId, step.agent_id, maps)
    } else {
      stepInsert.skill_id = await cloneSkill(supabase, userId, step.skill_id, maps)
    }
    const { error: stepError } = await supabase.from('workflow_steps').insert(stepInsert)
    if (stepError) throw stepError
  }

  // Exactly one v1 snapshot for the top-level cloned Workflow (US-022 AC5) —
  // taken once, after every step has been inserted, not once per write.
  const newSteps = await loadSteps(supabase, newWorkflow.id)
  await recordVersionSnapshot(supabase, 'WORKFLOW', newWorkflow.id, 1, { ...newWorkflow, steps: newSteps }, userId)

  return newWorkflow.id
}

const SOURCE_TABLE: Record<CloneItemType, string> = { AGENT: 'agents', SKILL: 'skills', WORKFLOW: 'workflows' }

cloneRouter.post('/:itemType/:id', async (c) => {
  const itemType = c.req.param('itemType') as CloneItemType
  if (!CLONE_ITEM_TYPES.includes(itemType)) {
    return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const userId = c.get('userId')!
  const sourceId = c.req.param('id')

  const { data: source, error: sourceError } = await supabase
    .from(SOURCE_TABLE[itemType])
    .select('id, status')
    .eq('id', sourceId)
    .maybeSingle()
  if (sourceError) throw sourceError
  if (!source) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  if (source.status !== 'Published') {
    return c.json({ error: 'source_not_published', requestId: c.get('requestId') }, 400)
  }

  let clonedItemId: string
  if (itemType === 'AGENT') {
    clonedItemId = await cloneAgent(supabase, userId, sourceId, newMaps())
  } else if (itemType === 'SKILL') {
    clonedItemId = await cloneSkill(supabase, userId, sourceId, newMaps())
  } else {
    clonedItemId = await cloneWorkflow(supabase, userId, sourceId)
  }

  const { error: cloneRecordError } = await supabase.from('clone_records').insert({
    source_item_type: itemType,
    source_item_id: sourceId,
    cloned_item_id: clonedItemId,
    cloned_by: userId,
  })
  if (cloneRecordError) throw cloneRecordError

  return c.json({ cloned: { item_type: itemType, id: clonedItemId } }, 201)
})

// US-021 AC2/AC3: one round trip for a detail page — where this item was
// cloned from (if anywhere), and how many times it has itself been cloned.
cloneRouter.get('/:itemType/:id', async (c) => {
  const itemType = c.req.param('itemType') as CloneItemType
  if (!CLONE_ITEM_TYPES.includes(itemType)) {
    return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const id = c.req.param('id')

  const { data: cloneRecord, error: cloneRecordError } = await supabase
    .from('clone_records')
    .select('source_item_type, source_item_id, cloned_at')
    .eq('cloned_item_id', id)
    .eq('source_item_type', itemType)
    .maybeSingle()
  if (cloneRecordError) throw cloneRecordError

  let provenance = null
  if (cloneRecord) {
    // The source may since have been Archived, or removed entirely
    // (US-021 AC4) — provenance still renders, just without a live name.
    const { data: sourceItem, error: sourceItemError } = await supabase
      .from('library_items')
      .select('name, status')
      .eq('item_type', cloneRecord.source_item_type)
      .eq('id', cloneRecord.source_item_id)
      .maybeSingle()
    if (sourceItemError) throw sourceItemError

    provenance = {
      source_item_type: cloneRecord.source_item_type,
      source_item_id: cloneRecord.source_item_id,
      source_name: sourceItem?.name ?? null,
      source_status: sourceItem?.status ?? null,
      cloned_at: cloneRecord.cloned_at,
    }
  }

  const { count, error: countError } = await supabase
    .from('clone_records')
    .select('id', { count: 'exact', head: true })
    .eq('source_item_type', itemType)
    .eq('source_item_id', id)
  if (countError) throw countError

  return c.json({ provenance, cloneCount: count ?? 0 })
})
