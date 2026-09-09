import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'

export const ratingsRouter = new Hono<AppEnv>()

ratingsRouter.use('*', requireAuth)

const MARKETPLACE_ITEM_TYPES = ['AGENT', 'SKILL', 'WORKFLOW'] as const
type MarketplaceItemType = (typeof MARKETPLACE_ITEM_TYPES)[number]

// US-030: submitting a score UPSERTs on (item_type, item_id, user_id) — a
// resubmit updates the rater's existing row rather than duplicating it
// (AC1/AC2). Score must be an integer 1-5 (AC3). Rating is only possible
// against a row visible in marketplace_items, which already excludes
// Draft/UnderReview items and Role/Task entirely (AC4/AC5) — no separate
// status check is needed here.
ratingsRouter.post('/items/:itemType/:id/rating', async (c) => {
  const itemType = c.req.param('itemType')
  if (!(MARKETPLACE_ITEM_TYPES as readonly string[]).includes(itemType)) {
    return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const score = body?.score
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return c.json({ error: 'invalid_score', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const userId = c.get('userId')!
  const id = c.req.param('id')

  const { data: item, error: itemError } = await supabase
    .from('marketplace_items')
    .select('item_type, id')
    .eq('item_type', itemType)
    .eq('id', id)
    .maybeSingle()
  if (itemError) throw itemError
  if (!item) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)

  const { error: upsertError } = await supabase.from('ratings').upsert(
    {
      item_type: itemType as MarketplaceItemType,
      item_id: id,
      user_id: userId,
      score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'item_type,item_id,user_id' },
  )
  if (upsertError) throw upsertError

  // Re-read the same row for the freshly recomputed aggregate (a live
  // subquery in the view, not a stored value) — satisfies AC2/AC3's "any
  // subsequent read, including the rater's own, reflects the new aggregate
  // immediately".
  const { data: updated, error: aggregateError } = await supabase
    .from('marketplace_items')
    .select('rating, rating_count')
    .eq('item_type', itemType)
    .eq('id', id)
    .single()
  if (aggregateError) throw aggregateError

  return c.json({ myRating: score, rating: updated.rating, rating_count: updated.rating_count })
})
