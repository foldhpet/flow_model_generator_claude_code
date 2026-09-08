import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'
import { recordVersionSnapshot } from '../versioning'
import { validateStatusTransition } from '../lifecycle'

export const tasksRouter = new Hono<AppEnv>()

tasksRouter.use('*', requireAuth)

const TASK_COLUMNS =
  'id, owner_id, role_id, name, instructions, status, current_version, created_at, updated_at'

tasksRouter.get('/', async (c) => {
  const supabase = c.get('supabase')
  const roleId = c.req.query('role_id')
  let query = supabase.from('tasks').select(TASK_COLUMNS).order('created_at', { ascending: false })
  if (roleId) query = query.eq('role_id', roleId)
  const { data, error } = await query
  if (error) throw error
  return c.json({ tasks: data ?? [] })
})

tasksRouter.get('/:id', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) throw error
  if (!data) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  return c.json({ task: data })
})

// US-006: role_id is required, and must belong to a Role owned by the
// caller — rejects both a missing role_id and one owned by someone else.
tasksRouter.post('/', async (c) => {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const roleId = typeof body?.role_id === 'string' ? body.role_id : ''
  if (!name) return c.json({ error: 'invalid_name', requestId: c.get('requestId') }, 400)
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

  const instructions = typeof body?.instructions === 'string' ? body.instructions : null
  const { data, error } = await supabase
    .from('tasks')
    .insert({ name, instructions, role_id: roleId, owner_id: userId })
    .select(TASK_COLUMNS)
    .single()
  if (error) throw error

  await recordVersionSnapshot(supabase, 'TASK', data.id, 1, data, userId!)
  return c.json({ task: data }, 201)
})

async function checkOwnership(c: Context<AppEnv>, id: string) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const { data, error } = await supabase.from('tasks').select('id, owner_id').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return 'not_found' as const
  if (data.owner_id !== userId) return 'forbidden' as const
  return 'ok' as const
}

// US-006 AC: a Task cannot be re-parented to a second Role once created —
// simplest correct enforcement is to reject any attempt to change role_id.
tasksRouter.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const ownership = await checkOwnership(c, id)
  if (ownership === 'not_found') {
    return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  }
  if (ownership === 'forbidden') {
    logRejection(c, 403, 'not_owner')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }

  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)

  if (typeof body?.role_id === 'string') {
    const { data: existing, error: fetchError } = await supabase
      .from('tasks')
      .select('role_id')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError
    if (body.role_id !== existing.role_id) {
      return c.json({ error: 'role_immutable', requestId: c.get('requestId') }, 400)
    }
  }

  const { data: current, error: fetchError } = await supabase
    .from('tasks')
    .select('current_version, status')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const nextStatus = typeof body?.status === 'string' ? body.status : undefined
  const transitionError = validateStatusTransition(current.status, nextStatus)
  if (transitionError) return c.json({ error: transitionError, requestId: c.get('requestId') }, 400)

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.name === 'string') {
    const name = body.name.trim()
    if (!name) return c.json({ error: 'invalid_name', requestId: c.get('requestId') }, 400)
    patch.name = name
  }
  if (typeof body?.instructions === 'string') patch.instructions = body.instructions
  if (nextStatus !== undefined) patch.status = nextStatus

  patch.current_version = current.current_version + 1

  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select(TASK_COLUMNS)
    .single()
  if (error) throw error

  await recordVersionSnapshot(supabase, 'TASK', id, patch.current_version as number, data, userId!)
  return c.json({ task: data })
})
