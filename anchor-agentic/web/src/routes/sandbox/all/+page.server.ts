import { fail } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { SandboxItem } from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

// All Sandbox: every registered user can read every item, but only the
// owner can write — attempting to edit someone else's item below is a
// deliberate demonstration of the write boundary (US-004), not a bug.
export const load: PageServerLoad = async ({ locals, fetch }) => {
	const { items } = await apiRequest<{ items: SandboxItem[] }>('/api/v1/sandbox/items', {
		accessToken: locals.session?.access_token,
		fetchFn: fetch
	});
	return { items };
};

export const actions: Actions = {
	attemptUpdate: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const title = String(form.get('title') ?? '').trim();
		if (!id || !title) return fail(400, { error: 'Title is required.' });

		try {
			await apiRequest(`/api/v1/sandbox/items/${id}`, {
				method: 'PATCH',
				body: JSON.stringify({ title }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) {
				return fail(err.status, {
					error: err.status === 403 ? 'Forbidden: you can only edit items you own.' : err.message
				});
			}
			throw err;
		}
		return { success: true };
	}
};
