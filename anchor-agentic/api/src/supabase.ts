import { createClient } from '@supabase/supabase-js'
import type { Context } from 'hono'
import type { AppEnv } from './types'

// Scoped to the caller's own JWT (forwarded as-is) rather than the service
// role, so every query runs as that user and RLS enforces per-caller access
// independently of any Worker-layer check. Anonymous callers get the anon
// role's RLS policies since no Authorization header is forwarded.
export function createRequestSupabaseClient(c: Context<AppEnv>) {
  const authHeader = c.req.header('Authorization')
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Service-role client: bypasses RLS entirely. Used only by the OAuth callback
// handler (GET /api/v1/github/callback), which has no authenticated user to
// forward and must authenticate the write via a signed state token instead.
// Never use this elsewhere — all other routes should use createRequestSupabaseClient.
export function createServiceRoleClient(c: Context<AppEnv>) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
