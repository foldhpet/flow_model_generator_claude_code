import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { createRequestSupabaseClient, createServiceRoleClient } from '../supabase'
import { rateLimitByIp } from '../middleware/rateLimit'

export const reportsRouter = new Hono<AppEnv>()

const MARKETPLACE_ITEM_TYPES = ['AGENT', 'SKILL', 'WORKFLOW'] as const
type MarketplaceItemType = (typeof MARKETPLACE_ITEM_TYPES)[number]

const REPORT_REASONS = ['ABUSIVE', 'BROKEN', 'SPAM', 'OTHER'] as const
type ReportReason = (typeof REPORT_REASONS)[number]

const TABLE: Record<MarketplaceItemType, string> = {
  AGENT: 'agents',
  SKILL: 'skills',
  WORKFLOW: 'workflows',
}

// US-045: deliberately its own router, not behind requireAuth like
// ratings.ts — anonymous visitors must be able to report (AC1/AC4).
// reporterId is soft-detected below instead of enforced by middleware.
reportsRouter.post(
  '/items/:itemType/:id/report',
  rateLimitByIp({ keyPrefix: 'report', limit: 5, windowSeconds: 600 }),
  async (c) => {
    const itemType = c.req.param('itemType')
    if (!(MARKETPLACE_ITEM_TYPES as readonly string[]).includes(itemType)) {
      return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const reason = body?.reason
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      return c.json({ error: 'invalid_reason', requestId: c.get('requestId') }, 400)
    }

    const detail = typeof body?.detail === 'string' ? body.detail : null
    if (detail !== null && detail.length > 2000) {
      return c.json({ error: 'detail_too_long', requestId: c.get('requestId') }, 400)
    }

    const id = c.req.param('id')
    const supabase = createRequestSupabaseClient(c)

    // Only a row currently visible in the Marketplace (i.e. Published) can be
    // reported — this view is already scoped that way, so no separate status
    // check is needed (same reasoning as ratings.ts).
    const { data: item, error: itemError } = await supabase
      .from('marketplace_items')
      .select('item_type, id')
      .eq('item_type', itemType)
      .eq('id', id)
      .maybeSingle()
    if (itemError) throw itemError
    if (!item) return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)

    const { data: userData } = await supabase.auth.getUser()
    const reporterId = userData?.user?.id ?? null

    const { data: report, error: insertError } = await supabase
      .from('abuse_reports')
      .insert({
        item_type: itemType as MarketplaceItemType,
        item_id: id,
        reporter_id: reporterId,
        reason: reason as ReportReason,
        detail,
      })
      .select('id, item_type, item_id, reporter_id, reason, status, created_at')
      .single()
    if (insertError) throw insertError

    // Neither an anonymous caller nor a non-owner/non-moderator authenticated
    // one has RLS permission to change item status, so this one write uses
    // the service-role client — guarded by .eq('status', 'Published') so a
    // second report on an already-UnderReview item is a harmless no-op.
    const serviceRole = createServiceRoleClient(c)
    const { error: flipError } = await serviceRole
      .from(TABLE[itemType as MarketplaceItemType])
      .update({ status: 'UnderReview', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'Published')
    if (flipError) throw flipError

    return c.json({ report }, 201)
  },
)
