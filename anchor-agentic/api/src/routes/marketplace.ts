import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { createRequestSupabaseClient } from '../supabase'

export const marketplaceRouter = new Hono<AppEnv>()

// Marketplace only ever shows Published items, regardless of caller auth
// state — this is a business rule on top of RLS, not a substitute for it.
marketplaceRouter.get('/items', async (c) => {
  const supabase = createRequestSupabaseClient(c)
  const { data, error } = await supabase
    .from('sandbox_items')
    .select('id, title, status, owner_id, created_at, updated_at')
    .eq('status', 'Published')
    .order('created_at', { ascending: false })
  if (error) throw error
  return c.json({ items: data ?? [] })
})

marketplaceRouter.get('/items/:id', async (c) => {
  const supabase = createRequestSupabaseClient(c)
  const { data, error } = await supabase
    .from('sandbox_items')
    .select('id, title, status, owner_id, created_at, updated_at')
    .eq('id', c.req.param('id'))
    .eq('status', 'Published')
    .maybeSingle()
  if (error) throw error
  // Never distinguishes "doesn't exist" from "not visible" (US-004 AC4).
  if (!data) {
    return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  }
  return c.json({ item: data })
})
