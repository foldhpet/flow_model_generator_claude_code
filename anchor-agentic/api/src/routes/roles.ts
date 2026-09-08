import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'
import { recordVersionSnapshot } from '../versioning'
import { validateStatusTransition } from '../lifecycle'

export const rolesRouter = new Hono<AppEnv>()

rolesRouter.use('*', requireAuth)

const ROLE_COLUMNS = 'id, owner_id, name, description, status, current_version, created_at, updated_at'

// Every registered user can read every Role, regardless of owner or status
// (Sandbox items are never private) — only writes are owner-restricted.
rolesRouter.get('/', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('roles')
    .select(ROLE_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return c.json({ roles: data ?? [] })
})

rolesRouter.get('/:id', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('roles')
    .select(ROLE_COLUMNS)
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) throw error
  if (!data) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  return c.json({ role: data })
})

// US-005: empty name rejected; two users can each own a Role with the same
// name (no uniqueness constraint) — owner_id is forced from the verified JWT.
rolesRouter.post('/', async (c) => {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return c.json({ error: 'invalid_name', requestId: c.get('requestId') }, 400)
  const description = typeof body?.description === 'string' ? body.description : null

  const { data, error } = await supabase
    .from('roles')
    .insert({ name, description, owner_id: userId })
    .select(ROLE_COLUMNS)
    .single()
  if (error) throw error

  await recordVersionSnapshot(supabase, 'ROLE', data.id, 1, data, userId!)
  return c.json({ role: data }, 201)
})

async function checkOwnership(c: Context<AppEnv>, id: string) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const { data, error } = await supabase.from('roles').select('id, owner_id').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return 'not_found' as const
  if (data.owner_id !== userId) return 'forbidden' as const
  return 'ok' as const
}

// Worker-layer ownership pre-check is intentionally redundant with RLS
// (0012_rls_policies_epic_b.sql) — both layers are exercised independently.
rolesRouter.patch('/:id', async (c) => {
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

  const { data: current, error: fetchError } = await supabase
    .from('roles')
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
  if (typeof body?.description === 'string') patch.description = body.description
  if (nextStatus !== undefined) patch.status = nextStatus

  const nextVersion = current.current_version + 1
  patch.current_version = nextVersion

  const { data, error } = await supabase
    .from('roles')
    .update(patch)
    .eq('id', id)
    .select(ROLE_COLUMNS)
    .single()
  if (error) throw error

  await recordVersionSnapshot(supabase, 'ROLE', id, nextVersion, data, userId!)
  return c.json({ role: data })
})
