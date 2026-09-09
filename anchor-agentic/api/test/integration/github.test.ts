import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signState } from '../../src/crypto'

const { createRequestSupabaseClient, createServiceRoleClient } = vi.hoisted(() => ({
	createRequestSupabaseClient: vi.fn(),
	createServiceRoleClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient, createServiceRoleClient }))

const USER_ID = 'user-123-abc'
const TEST_SIGNING_KEY = 'RBtXvS4qL2JnP8K1Y9mZ3eW6fD7oA0xC5bU2vJ4wT3s='
const TEST_ENCRYPTION_KEY = 'kbVFaZeZPaWMePPbUsmMW27D24FcHLHZzdyWfDKVJlk='

describe('GitHub OAuth routes', () => {
	beforeEach(() => {
		createRequestSupabaseClient.mockReset()
		createServiceRoleClient.mockReset()
	})

	describe('GET /authorize', () => {
		it('returns a well-formed GitHub OAuth URL with a signed state', async () => {
			const { createApp } = await import('../../src/app')
			const { testEnv } = await import('./testEnv')

			createRequestSupabaseClient.mockReturnValue({
				auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }) },
			})

			const app = createApp()
			const res = await app.request('/api/v1/github/authorize', {
				method: 'GET',
				headers: { Authorization: 'Bearer whatever' },
			}, testEnv)

			const body = (await res.json()) as { url?: string }

			expect(res.status).toBe(200)
			expect(body.url).toContain('https://github.com/login/oauth/authorize')
			expect(body.url).toContain('client_id=test-client-id')
			expect(body.url).toContain('scope=repo')
			expect(body.url).toContain('state=')

			const stateParam = new URL(body.url!).searchParams.get('state')
			expect(stateParam).toContain('.')
		})
	})

	describe('GET /callback', () => {
		it('redirects to settings?github=error when code is missing', async () => {
			const { createApp } = await import('../../src/app')
			const { testEnv } = await import('./testEnv')

			const app = createApp()
			const res = await app.request('/api/v1/github/callback?state=missing-code', {
				method: 'GET',
			}, testEnv)

			expect(res.status).toBe(302)
			expect(res.headers.get('location')).toContain('/settings?github=error')
		})

		it('redirects to settings?github=error on expired state', async () => {
			const { createApp } = await import('../../src/app')
			const { testEnv } = await import('./testEnv')

			const expiredState = await signState({ userId: USER_ID }, TEST_SIGNING_KEY, -1)

			const app = createApp()
			const res = await app.request(
				`/api/v1/github/callback?code=abc123&state=${encodeURIComponent(expiredState)}`,
				{ method: 'GET' },
				testEnv
			)

			expect(res.status).toBe(302)
			expect(res.headers.get('location')).toContain('/settings?github=error')
		})

		it('redirects to settings?github=error on tampered state', async () => {
			const { createApp } = await import('../../src/app')
			const { testEnv } = await import('./testEnv')

			const validState = await signState({ userId: USER_ID }, TEST_SIGNING_KEY, 600)
			const [payload] = validState.split('.')
			const tamperedState = `${payload}.tamperedsignature`

			const app = createApp()
			const res = await app.request(
				`/api/v1/github/callback?code=abc123&state=${encodeURIComponent(tamperedState)}`,
				{ method: 'GET' },
				testEnv
			)

			expect(res.status).toBe(302)
			expect(res.headers.get('location')).toContain('/settings?github=error')
		})
	})

	describe('GET /status', () => {
		it('returns connected: false and 200 status', async () => {
			const { createApp } = await import('../../src/app')
			const { testEnv, chain } = await import('./testEnv')

			const mockClient = {
				auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }) },
				from: vi.fn(() => ({
					select: vi.fn(() => ({
						eq: vi.fn(() => ({
							maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
						})),
					})),
				})),
			}
			createRequestSupabaseClient.mockReturnValue(mockClient)

			const app = createApp()
			const res = await app.request('/api/v1/github/status', {
				method: 'GET',
				headers: { Authorization: 'Bearer whatever' },
			}, testEnv)

			const body = (await res.json()) as { connected: boolean; github_username: string | null }

			expect(res.status).toBe(200)
			expect(body.connected).toBe(false)
			expect(body.github_username).toBeNull()
		})
	})

	describe('DELETE /', () => {
		it('returns 204 on successful deletion', async () => {
			const { createApp } = await import('../../src/app')
			const { testEnv } = await import('./testEnv')

			const mockClient = {
				auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }) },
				from: vi.fn(() => ({
					delete: vi.fn(() => ({
						eq: vi.fn(() => Promise.resolve({ error: null })),
					})),
				})),
			}
			createRequestSupabaseClient.mockReturnValue(mockClient)

			const app = createApp()
			const res = await app.request('/api/v1/github', {
				method: 'DELETE',
				headers: { Authorization: 'Bearer whatever' },
			}, testEnv)

			expect(res.status).toBe(204)
		})
	})
})
