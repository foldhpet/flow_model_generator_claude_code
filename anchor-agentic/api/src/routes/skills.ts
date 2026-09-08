import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'
import { recordVersionSnapshot } from '../versioning'
import { validateStatusTransition } from '../lifecycle'

export const skillsRouter = new Hono<AppEnv>()

skillsRouter.use('*', requireAuth)

const SKILL_COLUMNS =
  'id, owner_id, name, description, skill_files, status, current_version, created_at, updated_at'

skillsRouter.get('/', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('skills')
    .select(SKILL_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return c.json({ skills: data ?? [] })
})

skillsRouter.get('/:id', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('skills')
    .select(SKILL_COLUMNS)
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) throw error
  if (!data) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  return c.json({ skill: data })
})

function normalizeSkillFiles(value: unknown): { path: string; content: string }[] | null {
  if (!Array.isArray(value)) return null
  const files = value.filter(
    (f): f is { path: string; content: string } =>
      !!f && typeof f.path === 'string' && f.path.trim() !== '' && typeof f.content === 'string',
  )
  return files
}

// US-009: independent of Role — no role_id anywhere on this table.
skillsRouter.post('/', async (c) => {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return c.json({ error: 'invalid_name', requestId: c.get('requestId') }, 400)

  const description = typeof body?.description === 'string' ? body.description : null
  const skillFiles = normalizeSkillFiles(body?.skill_files) ?? []

  const { data, error } = await supabase
    .from('skills')
    .insert({ name, description, skill_files: skillFiles, owner_id: userId })
    .select(SKILL_COLUMNS)
    .single()
  if (error) throw error

  await recordVersionSnapshot(supabase, 'SKILL', data.id, 1, data, userId!)
  return c.json({ skill: data }, 201)
})

async function checkOwnership(c: Context<AppEnv>, id: string) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const { data, error } = await supabase.from('skills').select('id, owner_id').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return 'not_found' as const
  if (data.owner_id !== userId) return 'forbidden' as const
  return 'ok' as const
}

skillsRouter.patch('/:id', async (c) => {
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
    .from('skills')
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
  if (body?.skill_files !== undefined) {
    const files = normalizeSkillFiles(body.skill_files)
    if (!files) return c.json({ error: 'invalid_skill_files', requestId: c.get('requestId') }, 400)
    patch.skill_files = files
  }
  if (nextStatus !== undefined) patch.status = nextStatus

  patch.current_version = current.current_version + 1

  const { data, error } = await supabase
    .from('skills')
    .update(patch)
    .eq('id', id)
    .select(SKILL_COLUMNS)
    .single()
  if (error) throw error

  await recordVersionSnapshot(supabase, 'SKILL', id, patch.current_version as number, data, userId!)
  return c.json({ skill: data })
})
