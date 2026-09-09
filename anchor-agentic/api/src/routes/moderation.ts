import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { requireModerator } from '../middleware/moderator'

export const moderationRouter = new Hono<AppEnv>()

moderationRouter.use('*', requireAuth, requireModerator)

type ModeratableItemType = 'AGENT' | 'SKILL' | 'WORKFLOW'
const ITEM_TYPES: ModeratableItemType[] = ['AGENT', 'SKILL', 'WORKFLOW']

const TABLE: Record<ModeratableItemType, string> = {
  AGENT: 'agents',
  SKILL: 'skills',
  WORKFLOW: 'workflows',
}

const COLUMNS: Record<ModeratableItemType, string> = {
  AGENT:
    'id, owner_id, role_id, system_prompt, status, current_version, published_version, review_feedback, created_at, updated_at',
  SKILL:
    'id, owner_id, name, description, skill_files, status, current_version, published_version, review_feedback, created_at, updated_at',
  WORKFLOW:
    'id, owner_id, name, description, status, current_version, published_version, review_feedback, created_at, updated_at',
}

// US-044/US-046: every UnderReview row across all three publishable item
// types, enriched with its OPEN abuse_reports. An empty reports array means
// the item got here via US-044's voluntary requestReview, not a report — the
// UI uses that distinction to decide whether to offer approve/reject or
// remove/dismiss.
moderationRouter.get('/queue', async (c) => {
  const supabase = c.get('supabase')

  const results = await Promise.all(
    ITEM_TYPES.map((itemType) =>
      supabase
        .from(TABLE[itemType])
        .select(COLUMNS[itemType])
        .eq('status', 'UnderReview')
        .order('updated_at', { ascending: true }),
    ),
  )
  for (const result of results) if (result.error) throw result.error

  const items = ITEM_TYPES.flatMap((itemType, i) => (results[i].data ?? []).map((item) => ({ item_type: itemType, ...item })))

  if (items.length === 0) return c.json({ queue: [] })

  const { data: reports, error: reportsError } = await supabase
    .from('abuse_reports')
    .select('id, item_type, item_id, reporter_id, reason, detail, status, created_at')
    .eq('status', 'OPEN')
    .in(
      'item_id',
      items.map((item) => item.id),
    )
  if (reportsError) throw reportsError

  const queue = items.map((item) => ({
    ...item,
    reports: (reports ?? []).filter((report) => report.item_type === item.item_type && report.item_id === item.id),
  }))

  return c.json({ queue })
})

async function loadItem(c: Context<AppEnv>, itemType: ModeratableItemType, id: string) {
  const supabase = c.get('supabase')
  const { data, error } = await supabase.from(TABLE[itemType]).select(COLUMNS[itemType]).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

function parseItemType(c: Context<AppEnv>): ModeratableItemType | null {
  const itemType = c.req.param('itemType')
  return (ITEM_TYPES as readonly string[]).includes(itemType) ? (itemType as ModeratableItemType) : null
}

// US-044 AC accept: content was already frozen (version bumped, snapshot
// recorded) when publish.ts's requestReview branch ran, so approving only
// flips status and freezes published_version — no new version bump.
moderationRouter.post('/items/:itemType/:id/approve', async (c) => {
  const itemType = parseItemType(c)
  if (!itemType) return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  const id = c.req.param('id')
  const supabase = c.get('supabase')

  const item = await loadItem(c, itemType, id)
  if (!item) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  if (item.status !== 'UnderReview') {
    return c.json({ error: 'item_not_under_review', requestId: c.get('requestId') }, 400)
  }

  const { data: updated, error } = await supabase
    .from(TABLE[itemType])
    .update({
      status: 'Published',
      published_version: item.current_version,
      review_feedback: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(COLUMNS[itemType])
    .single()
  if (error) throw error

  return c.json({ approved: { item_type: itemType, id, version: item.current_version }, item: updated })
})

// US-044 AC reject: returns the item to Draft with optional feedback so the
// owner can revise and resubmit. No version bump — nothing about the
// content changes here, only its lifecycle status.
moderationRouter.post('/items/:itemType/:id/reject', async (c) => {
  const itemType = parseItemType(c)
  if (!itemType) return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  const id = c.req.param('id')
  const supabase = c.get('supabase')

  const item = await loadItem(c, itemType, id)
  if (!item) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  if (item.status !== 'UnderReview') {
    return c.json({ error: 'item_not_under_review', requestId: c.get('requestId') }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const feedback = typeof body?.feedback === 'string' ? body.feedback : null

  const { data: updated, error } = await supabase
    .from(TABLE[itemType])
    .update({ status: 'Draft', review_feedback: feedback, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUMNS[itemType])
    .single()
  if (error) throw error

  return c.json({ rejected: { item_type: itemType, id }, item: updated })
})

// US-046: terminal — Removed has no path back (lifecycle.ts). An "unfounded
// report" must be handled by dismissing it before this ever runs.
moderationRouter.post('/items/:itemType/:id/remove', async (c) => {
  const itemType = parseItemType(c)
  if (!itemType) return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  const id = c.req.param('id')
  const supabase = c.get('supabase')
  const userId = c.get('userId')!

  const item = await loadItem(c, itemType, id)
  if (!item) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  if (item.status !== 'UnderReview') {
    return c.json({ error: 'item_not_under_review', requestId: c.get('requestId') }, 400)
  }

  const { data: updated, error } = await supabase
    .from(TABLE[itemType])
    .update({ status: 'Removed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUMNS[itemType])
    .single()
  if (error) throw error

  const { error: reportsError } = await supabase
    .from('abuse_reports')
    .update({ status: 'RESOLVED_REMOVED', resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq('item_type', itemType)
    .eq('item_id', id)
    .eq('status', 'OPEN')
  if (reportsError) throw reportsError

  return c.json({ removed: { item_type: itemType, id }, item: updated })
})

// US-046: dismissing the last OPEN report on an UnderReview item restores it
// to Published — this is how an "unfounded report" is undone, since Removed
// itself is terminal (AC4 wins over AC3's contradictory "unremove" text).
moderationRouter.post('/reports/:reportId/dismiss', async (c) => {
  const reportId = c.req.param('reportId')
  const supabase = c.get('supabase')
  const userId = c.get('userId')!

  const { data: report, error } = await supabase
    .from('abuse_reports')
    .select('id, item_type, item_id, status')
    .eq('id', reportId)
    .maybeSingle()
  if (error) throw error
  if (!report) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  if (report.status !== 'OPEN') {
    return c.json({ error: 'report_not_open', requestId: c.get('requestId') }, 400)
  }

  const { error: dismissError } = await supabase
    .from('abuse_reports')
    .update({ status: 'RESOLVED_DISMISSED', resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq('id', reportId)
  if (dismissError) throw dismissError

  const { count, error: countError } = await supabase
    .from('abuse_reports')
    .select('id', { count: 'exact', head: true })
    .eq('item_type', report.item_type)
    .eq('item_id', report.item_id)
    .eq('status', 'OPEN')
  if (countError) throw countError

  let restored = false
  if ((count ?? 0) === 0) {
    const { data: restoredRows, error: restoreError } = await supabase
      .from(TABLE[report.item_type as ModeratableItemType])
      .update({ status: 'Published', updated_at: new Date().toISOString() })
      .eq('id', report.item_id)
      .eq('status', 'UnderReview')
      .select('id')
    if (restoreError) throw restoreError
    restored = (restoredRows ?? []).length > 0
  }

  return c.json({ dismissed: { report_id: reportId }, restored })
})
