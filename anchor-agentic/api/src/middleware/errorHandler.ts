import type { Context, ErrorHandler } from 'hono'
import type { AppEnv } from '../types'
import type { QualityIssue } from '../contentEvaluation'

// US-004 AC5: every 401/403 is logged with its correlated request ID.
export function logRejection(c: Context<AppEnv>, status: number, reason: string) {
  console.log(
    JSON.stringify({
      requestId: c.get('requestId'),
      path: c.req.path,
      method: c.req.method,
      userId: c.get('userId') ?? null,
      status,
      reason,
    }),
  )
}

// US-042 AC4: every automated content-evaluation outcome (pass or fail) is
// logged for later analysis via `wrangler tail` — no paid logging service.
export function logEvaluationOutcome(
  c: Context<AppEnv>,
  outcome: { itemType: string; id: string; passed: boolean; issues: QualityIssue[] },
) {
  console.log(
    JSON.stringify({
      requestId: c.get('requestId'),
      event: 'content_evaluation',
      itemType: outcome.itemType,
      itemId: outcome.id,
      passed: outcome.passed,
      issueCodes: outcome.issues.map((i) => i.code),
    }),
  )
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId')
  console.error(
    JSON.stringify({ requestId, path: c.req.path, method: c.req.method, error: err.message }),
  )
  return c.json({ error: 'internal_error', requestId }, 500)
}
