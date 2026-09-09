import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { requestId } from './middleware/requestId'
import { errorHandler } from './middleware/errorHandler'
import { marketplaceRouter } from './routes/marketplace'
import { ratingsRouter } from './routes/ratings'
import { sandboxRouter } from './routes/sandbox'
import { rolesRouter } from './routes/roles'
import { tasksRouter } from './routes/tasks'
import { agentsRouter } from './routes/agents'
import { skillsRouter } from './routes/skills'
import { workflowsRouter } from './routes/workflows'
import { libraryRouter } from './routes/library'
import { cloneRouter } from './routes/clone'
import { publishRouter } from './routes/publish'
import { exportRouter } from './routes/export'
import { githubRouter } from './routes/github'

export function createApp() {
  const app = new Hono<AppEnv>()

  app.use('*', requestId)
  app.use('*', (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN, credentials: true })(c, next))

  app.onError(errorHandler)

  app.get('/api/v1/healthz', (c) => c.json({ ok: true }))
  app.route('/api/v1/marketplace', marketplaceRouter)
  app.route('/api/v1/marketplace', ratingsRouter)
  app.route('/api/v1/sandbox', sandboxRouter)
  app.route('/api/v1/roles', rolesRouter)
  app.route('/api/v1/tasks', tasksRouter)
  app.route('/api/v1/agents', agentsRouter)
  app.route('/api/v1/skills', skillsRouter)
  app.route('/api/v1/workflows', workflowsRouter)
  app.route('/api/v1/library', libraryRouter)
  app.route('/api/v1/clone', cloneRouter)
  app.route('/api/v1/publish', publishRouter)
  app.route('/api/v1/export', exportRouter)
  app.route('/api/v1/github', githubRouter)

  return app
}
