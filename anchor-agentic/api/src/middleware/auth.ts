import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'
import { createRequestSupabaseClient } from '../supabase'
import { logRejection } from './errorHandler'

// Registered on the sandbox router's '*' prefix, so it 401s before any
// handler runs — including for undefined sub-paths (US-004 AC1).
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const supabase = createRequestSupabaseClient(c)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    logRejection(c, 401, 'missing_or_invalid_token')
    return c.json({ error: 'unauthorized', requestId: c.get('requestId') }, 401)
  }
  c.set('supabase', supabase)
  c.set('userId', data.user.id)
  await next()
})
