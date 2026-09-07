import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { requestId } from './middleware/requestId'
import { errorHandler } from './middleware/errorHandler'
import { marketplaceRouter } from './routes/marketplace'
import { sandboxRouter } from './routes/sandbox'

export function createApp() {
  const app = new Hono<AppEnv>()

  app.use('*', requestId)
  app.use('*', (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN, credentials: true })(c, next))

  app.onError(errorHandler)

  app.get('/api/v1/healthz', (c) => c.json({ ok: true }))
  app.route('/api/v1/marketplace', marketplaceRouter)
  app.route('/api/v1/sandbox', sandboxRouter)

  return app
}
