import { fail } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { ModerationQueueItem } from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

// Access to this route is already restricted to is_moderator by
// moderationGuard in hooks.server.ts — this file only needs to talk to the
// API, which independently re-checks the same flag server-side.
export const load: PageServerLoad = async ({ locals, fetch }) => {
	const { queue } = await apiRequest<{ queue: ModerationQueueItem[] }>('/api/v1/moderation/queue', {
		accessToken: locals.session?.access_token,
		fetchFn: fetch
	});
	return { queue };
};

export const actions: Actions = {
	approve: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const itemType = String(form.get('item_type') ?? '');
		const id = String(form.get('id') ?? '');

		try {
			await apiRequest(`/api/v1/moderation/items/${itemType}/${id}/approve`, {
				method: 'POST',
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	reject: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const itemType = String(form.get('item_type') ?? '');
		const id = String(form.get('id') ?? '');
		const feedback = String(form.get('feedback') ?? '').trim();

		try {
			await apiRequest(`/api/v1/moderation/items/${itemType}/${id}/reject`, {
				method: 'POST',
				body: JSON.stringify({ feedback: feedback || undefined }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	remove: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const itemType = String(form.get('item_type') ?? '');
		const id = String(form.get('id') ?? '');

		try {
			await apiRequest(`/api/v1/moderation/items/${itemType}/${id}/remove`, {
				method: 'POST',
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	dismiss: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const reportId = String(form.get('report_id') ?? '');

		try {
			await apiRequest(`/api/v1/moderation/reports/${reportId}/dismiss`, {
				method: 'POST',
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	}
};
