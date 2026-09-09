import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'
import { createServiceRoleClient } from '../supabase'
import { decryptToken, encryptToken, signState, verifyState } from '../crypto'

export const githubRouter = new Hono<AppEnv>()

// GET /authorize — authenticate the connect request, return the GitHub OAuth URL
githubRouter.get('/authorize', requireAuth, async (c) => {
	const userId = c.get('userId')!
	const state = await signState({ userId }, c.env.WORKER_SIGNING_SECRET, 600)

	const params = new URLSearchParams({
		client_id: c.env.GITHUB_OAUTH_CLIENT_ID,
		redirect_uri: c.env.GITHUB_OAUTH_REDIRECT_URI,
		scope: 'repo',
		state,
	})

	const url = `https://github.com/login/oauth/authorize?${params.toString()}`
	return c.json({ url })
})

// GET /callback — GitHub's OAuth redirect (unauthenticated, state-signed)
// Redirect from GitHub carries: code, state. Verify state → exchange code for token
// → fetch user info → encrypt token → upsert via service-role client → 302 back to settings
githubRouter.get('/callback', async (c) => {
	const code = c.req.query('code')
	const state = c.req.query('state')

	if (!code || !state) {
		logRejection(c, 400, 'missing_oauth_params')
		return c.redirect(
			`${c.env.ALLOWED_ORIGIN}/settings?github=error&reason=missing_code_or_state`,
			302
		)
	}

	try {
		// Verify the state signature (also checks expiry)
		const stateData = await verifyState(state, c.env.WORKER_SIGNING_SECRET)
		const userId = stateData.userId as string | undefined

		if (!userId || typeof userId !== 'string') {
			logRejection(c, 400, 'invalid_state_user_id')
			return c.redirect(
				`${c.env.ALLOWED_ORIGIN}/settings?github=error&reason=invalid_state`,
				302
			)
		}

		// Exchange code for access token (GitHub REST API)
		const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_id: c.env.GITHUB_OAUTH_CLIENT_ID,
				client_secret: c.env.GITHUB_OAUTH_CLIENT_SECRET,
				code,
			}),
		})

		if (!tokenRes.ok) {
			logRejection(c, tokenRes.status, 'github_token_exchange_failed')
			return c.redirect(
				`${c.env.ALLOWED_ORIGIN}/settings?github=error&reason=token_exchange_failed`,
				302
			)
		}

		const tokenData = (await tokenRes.json()) as
			| { access_token?: string; error?: string }
			| undefined

		if (!tokenData?.access_token) {
			logRejection(c, 400, 'github_token_exchange_no_token')
			return c.redirect(
				`${c.env.ALLOWED_ORIGIN}/settings?github=error&reason=${tokenData?.error ?? 'unknown'}`,
				302
			)
		}

		// Fetch user info to get the GitHub username
		const userRes = await fetch('https://api.github.com/user', {
			headers: { Authorization: `Bearer ${tokenData.access_token}` },
		})

		if (!userRes.ok) {
			logRejection(c, userRes.status, 'github_user_fetch_failed')
			return c.redirect(
				`${c.env.ALLOWED_ORIGIN}/settings?github=error&reason=user_fetch_failed`,
				302
			)
		}

		const userData = (await userRes.json()) as { login?: string } | undefined
		const githubUsername = userData?.login

		if (!githubUsername) {
			logRejection(c, 400, 'github_user_no_login')
			return c.redirect(
				`${c.env.ALLOWED_ORIGIN}/settings?github=error&reason=no_github_username`,
				302
			)
		}

		// Encrypt the token before storing
		const { ciphertext, iv } = await encryptToken(
			tokenData.access_token,
			c.env.GITHUB_TOKEN_ENCRYPTION_KEY
		)

		// Upsert via service-role client (no auth header from browser)
		const supabaseServiceRole = createServiceRoleClient(c)
		const { error } = await supabaseServiceRole
			.from('github_credentials')
			.upsert({
				user_id: userId,
				github_username: githubUsername,
				encrypted_token: ciphertext,
				token_iv: iv,
			})

		if (error) {
			logRejection(c, 500, 'github_credentials_upsert_failed')
			return c.redirect(
				`${c.env.ALLOWED_ORIGIN}/settings?github=error&reason=database_error`,
				302
			)
		}

		return c.redirect(`${c.env.ALLOWED_ORIGIN}/settings?github=connected`, 302)
	} catch (err) {
		const reason = err instanceof Error ? err.message : 'unknown_error'
		logRejection(c, 500, reason)
		return c.redirect(
			`${c.env.ALLOWED_ORIGIN}/settings?github=error&reason=${encodeURIComponent(reason)}`,
			302
		)
	}
})

// GET /status — check if the user has GitHub connected
githubRouter.get('/status', requireAuth, async (c) => {
	const userId = c.get('userId')!
	const supabase = c.get('supabase')

	const { data, error } = await supabase
		.from('github_credentials')
		.select('github_username')
		.eq('user_id', userId)
		.maybeSingle()

	if (error) throw error

	return c.json({
		connected: !!data,
		github_username: data?.github_username ?? null,
	})
})

// DELETE / — revoke GitHub connection
githubRouter.delete('/', requireAuth, async (c) => {
	const userId = c.get('userId')!
	const supabase = c.get('supabase')

	const { error } = await supabase
		.from('github_credentials')
		.delete()
		.eq('user_id', userId)

	if (error) throw error

	return new Response(null, { status: 204 })
})
