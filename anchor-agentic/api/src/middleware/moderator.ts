import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'
import { logRejection } from './errorHandler'

// Always chained after requireAuth (needs c.get('userId') and c.get('supabase')
// already set). is_moderator is a manual DB flag (0020_moderators.sql) with no
// self-service elevation UI — this middleware only checks it, never sets it.
export const requireModerator = createMiddleware<AppEnv>(async (c, next) => {
  const supabase = c.get('supabase')
  const userId = c.get('userId')!

  const { data, error } = await supabase.from('profiles').select('is_moderator').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data?.is_moderator) {
    logRejection(c, 403, 'not_moderator')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }

  await next()
})
