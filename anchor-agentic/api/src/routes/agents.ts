import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'
import { recordVersionSnapshot } from '../versioning'
import { validateStatusTransition } from '../lifecycle'

export const agentsRouter = new Hono<AppEnv>()

agentsRouter.use('*', requireAuth)

const AGENT_COLUMNS =
  'id, owner_id, role_id, system_prompt, status, current_version, published_version, created_at, updated_at'

agentsRouter.get('/', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('agents')
    .select(AGENT_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return c.json({ agents: data ?? [] })
})

agentsRouter.get('/:id', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('agents')
    .select(AGENT_COLUMNS)
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) throw error
  if (!data) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  return c.json({ agent: data })
})

// US-007: fulfils exactly one Role. Empty system_prompt is allowed at
// Draft-save (only flagged at publish time, a later story).
agentsRouter.post('/', async (c) => {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const roleId = typeof body?.role_id === 'string' ? body.role_id : ''
  if (!roleId) return c.json({ error: 'role_id_required', requestId: c.get('requestId') }, 400)

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, owner_id')
    .eq('id', roleId)
    .maybeSingle()
  if (roleError) throw roleError
  if (!role || role.owner_id !== userId) {
    return c.json({ error: 'role_not_owned', requestId: c.get('requestId') }, 400)
  }

  const systemPrompt = typeof body?.system_prompt === 'string' ? body.system_prompt : null
  const { data, error } = await supabase
    .from('agents')
    .insert({ role_id: roleId, system_prompt: systemPrompt, owner_id: userId })
    .select(AGENT_COLUMNS)
    .single()
  if (error) {
    // Maps the role_id unique-constraint violation to a domain-specific
    // message rather than a raw Postgres error (Architecture Decision 5).
    if ((error as { code?: string }).code === '23505') {
      return c.json({ error: 'role_already_has_agent', requestId: c.get('requestId') }, 409)
    }
    throw error
  }

  await recordVersionSnapshot(supabase, 'AGENT', data.id, 1, data, userId!)
  return c.json({ agent: data }, 201)
})

async function checkOwnership(c: Context<AppEnv>, id: string) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const { data, error } = await supabase
    .from('agents')
    .select('id, owner_id, role_id, status, current_version')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return { result: 'not_found' as const, agent: null }
  if (data.owner_id !== userId) return { result: 'forbidden' as const, agent: null }
  return { result: 'ok' as const, agent: data }
}

agentsRouter.patch('/:id', async (c) => {
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

  if (typeof body?.role_id === 'string' && body.role_id !== ownership.agent!.role_id) {
    return c.json({ error: 'role_immutable', requestId: c.get('requestId') }, 400)
  }

  const nextStatus = typeof body?.status === 'string' ? body.status : undefined
  const transitionError = validateStatusTransition(ownership.agent!.status, nextStatus)
  if (transitionError) return c.json({ error: transitionError, requestId: c.get('requestId') }, 400)

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.system_prompt === 'string') patch.system_prompt = body.system_prompt
  if (nextStatus !== undefined) patch.status = nextStatus

  const { data: current, error: fetchError } = await supabase
    .from('agents')
    .select('current_version')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  patch.current_version = current.current_version + 1

  const { data, error } = await supabase
    .from('agents')
    .update(patch)
    .eq('id', id)
    .select(AGENT_COLUMNS)
    .single()
  if (error) throw error

  await recordVersionSnapshot(supabase, 'AGENT', id, patch.current_version as number, data, userId!)
  return c.json({ agent: data })
})

// US-008: Tasks currently assigned to this Agent (joined with the Task row
// so the UI can render names without a second round trip).
agentsRouter.get('/:id/tasks', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('id, task_id, tasks(id, name, role_id, status)')
    .eq('agent_id', c.req.param('id'))
  if (error) throw error
  return c.json({ assignments: data ?? [] })
})

async function loadAgentAndTask(c: Context<AppEnv>, agentId: string, taskId: string) {
  const supabase = c.get('supabase')
  const [{ data: agent, error: agentError }, { data: task, error: taskError }] = await Promise.all([
    supabase.from('agents').select('id, owner_id, role_id, status, current_version').eq('id', agentId).maybeSingle(),
    supabase.from('tasks').select('id, role_id').eq('id', taskId).maybeSingle(),
  ])
  if (agentError) throw agentError
  if (taskError) throw taskError
  return { agent, task }
}

// US-008: a Task can only be assigned to the Agent fulfilling its own Role.
agentsRouter.post('/:id/tasks/:taskId', async (c) => {
  const agentId = c.req.param('id')
  const taskId = c.req.param('taskId')
  const userId = c.get('userId')
  const supabase = c.get('supabase')

  const { agent, task } = await loadAgentAndTask(c, agentId, taskId)
  if (!agent) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  if (agent.owner_id !== userId) {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }
  if (agent.status === 'Archived') {
    return c.json({ error: 'archived_item_is_terminal', requestId: c.get('requestId') }, 400)
  }
  if (!task) return c.json({ error: 'task_not_found', requestId: c.get('requestId') }, 404)
  if (task.role_id !== agent.role_id) {
    return c.json({ error: 'task_role_mismatch', requestId: c.get('requestId') }, 400)
  }

  const { error } = await supabase.from('agent_tasks').insert({ agent_id: agentId, task_id: taskId })
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return c.json({ error: 'already_assigned', requestId: c.get('requestId') }, 409)
    }
    throw error
  }

  const nextVersion = agent.current_version + 1
  await supabase.from('agents').update({ current_version: nextVersion, updated_at: new Date().toISOString() }).eq('id', agentId)
  await recordVersionSnapshot(supabase, 'AGENT', agentId, nextVersion, { ...agent, current_version: nextVersion, assigned_task_id: taskId, action: 'assign' }, userId!)
  return c.body(null, 204)
})

// US-008: unassigning removes the join row and still records a new snapshot.
agentsRouter.delete('/:id/tasks/:taskId', async (c) => {
  const agentId = c.req.param('id')
  const taskId = c.req.param('taskId')
  const userId = c.get('userId')
  const supabase = c.get('supabase')

  const ownership = await checkOwnership(c, agentId)
  if (ownership.result === 'not_found') {
    return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  }
  if (ownership.result === 'forbidden') {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }
  if (ownership.agent!.status === 'Archived') {
    return c.json({ error: 'archived_item_is_terminal', requestId: c.get('requestId') }, 400)
  }

  const { error } = await supabase.from('agent_tasks').delete().eq('agent_id', agentId).eq('task_id', taskId)
  if (error) throw error

  const nextVersion = ownership.agent!.current_version + 1
  await supabase.from('agents').update({ current_version: nextVersion, updated_at: new Date().toISOString() }).eq('id', agentId)
  await recordVersionSnapshot(supabase, 'AGENT', agentId, nextVersion, { ...ownership.agent, current_version: nextVersion, unassigned_task_id: taskId, action: 'unassign' }, userId!)
  return c.body(null, 204)
})
