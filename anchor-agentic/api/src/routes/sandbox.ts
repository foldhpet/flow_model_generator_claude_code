import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'

export const sandboxRouter = new Hono<AppEnv>()

sandboxRouter.use('*', requireAuth)

// All Sandbox: every registered user can read every item, regardless of
// owner or status — only writes are owner-restricted.
sandboxRouter.get('/items', async (c) => {
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('sandbox_items')
    .select('id, title, status, owner_id, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return c.json({ items: data ?? [] })
})

sandboxRouter.post('/items', async (c) => {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return c.json({ error: 'invalid_title', requestId: c.get('requestId') }, 400)
  }
  const { data, error } = await supabase
    .from('sandbox_items')
    .insert({ title, owner_id: userId })
    .select('id, title, status, owner_id, created_at, updated_at')
    .single()
  if (error) throw error
  return c.json({ item: data }, 201)
})

async function checkOwnership(c: Context<AppEnv>, id: string) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const { data, error } = await supabase
    .from('sandbox_items')
    .select('id, owner_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return 'not_found' as const
  if (data.owner_id !== userId) return 'forbidden' as const
  return 'ok' as const
}

// Worker-layer ownership pre-check below is intentionally redundant with the
// database's owner_update/owner_delete RLS policies (0004_rls_policies.sql) —
// both layers are exercised independently (US-004 AC2/AC3).
sandboxRouter.patch('/items/:id', async (c) => {
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
  const body = await c.req.json().catch(() => null)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.title === 'string' && body.title.trim()) patch.title = body.title.trim()
  if (typeof body?.status === 'string') patch.status = body.status
  const { data, error } = await supabase
    .from('sandbox_items')
    .update(patch)
    .eq('id', id)
    .select('id, title, status, owner_id, created_at, updated_at')
    .single()
  if (error) throw error
  return c.json({ item: data })
})

sandboxRouter.delete('/items/:id', async (c) => {
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
  const { error } = await supabase.from('sandbox_items').delete().eq('id', id)
  if (error) throw error
  return c.body(null, 204)
})
