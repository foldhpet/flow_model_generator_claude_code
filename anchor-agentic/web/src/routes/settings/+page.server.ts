import { fail, type Actions } from '@sveltejs/kit'
import { apiRequest, ApiError, type ApiError as ApiErrorType } from '$lib/api/client'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const { connected, github_username } = await apiRequest<{
		connected: boolean
		github_username: string | null
	}>('/api/v1/github/status', {
		accessToken: locals.session?.access_token,
		fetchFn: fetch,
	})

	return {
		github: { connected, username: github_username },
	}
}

export const actions: Actions = {
	connect: async ({ locals, fetch }) => {
		try {
			const { url } = await apiRequest<{ url: string }>('/api/v1/github/authorize', {
				method: 'GET',
				accessToken: locals.session?.access_token,
				fetchFn: fetch,
			})
			// The browser will redirect to GitHub's OAuth consent screen
			throw new Response(null, {
				status: 303,
				headers: { Location: url },
			})
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message })
			throw err
		}
	},

	revoke: async ({ locals, fetch }) => {
		try {
			await apiRequest('/api/v1/github', {
				method: 'DELETE',
				accessToken: locals.session?.access_token,
				fetchFn: fetch,
			})
			return { success: true }
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message })
			throw err
		}
	},
}
