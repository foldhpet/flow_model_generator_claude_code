import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import type { VersionedItemType } from '../versioning'

export const libraryRouter = new Hono<AppEnv>()

libraryRouter.use('*', requireAuth)

const ITEM_TYPES: VersionedItemType[] = ['ROLE', 'TASK', 'AGENT', 'SKILL', 'WORKFLOW']

function parsePage(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// US-016/017/018: a single searchable, cross-entity read surface backing
// /library (My Library) and /library/all (All Library). RLS on the
// underlying tables — inherited via the view's security_invoker — is what
// actually enforces "read all, write own"; this endpoint has no write path.
libraryRouter.get('/', async (c) => {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const scope = c.req.query('scope') === 'mine' ? 'mine' : 'all'
  const type = c.req.query('type')
  const q = c.req.query('q')
  const page = parsePage(c.req.query('page'), 1)
  const pageSize = parsePage(c.req.query('pageSize'), 20)

  let query = supabase
    .from('library_items')
    .select('item_type, id, owner_id, name, status, current_version, created_at, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })

  if (scope === 'mine') query = query.eq('owner_id', userId)
  if (type && (ITEM_TYPES as string[]).includes(type)) query = query.eq('item_type', type)
  if (q && q.trim()) query = query.textSearch('search_vector', q.trim(), { type: 'plain' })

  const from = (page - 1) * pageSize
  const { data, error, count } = await query.range(from, from + pageSize - 1)
  if (error) throw error

  return c.json({ items: data ?? [], total: count ?? 0, page, pageSize })
})

// US-015: read-only version history, available to any registered user (not
// just the owner) — there is deliberately no restore/write endpoint here.
libraryRouter.get('/:itemType/:id/versions', async (c) => {
  const supabase = c.get('supabase')
  const itemType = c.req.param('itemType')
  const id = c.req.param('id')
  if (!(ITEM_TYPES as string[]).includes(itemType)) {
    return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  }

  const { data: parent, error: parentError } = await supabase
    .from('library_items')
    .select('id')
    .eq('item_type', itemType)
    .eq('id', id)
    .maybeSingle()
  if (parentError) throw parentError
  if (!parent) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)

  const page = parsePage(c.req.query('page'), 1)
  const pageSize = parsePage(c.req.query('pageSize'), 20)
  const from = (page - 1) * pageSize

  const { data, error, count } = await supabase
    .from('version_snapshots')
    .select('id, item_type, item_id, version_number, snapshot_data, created_by, created_at', { count: 'exact' })
    .eq('item_type', itemType)
    .eq('item_id', id)
    .order('version_number', { ascending: false })
    .range(from, from + pageSize - 1)
  if (error) throw error

  return c.json({ versions: data ?? [], total: count ?? 0, page, pageSize })
})
