import { fail } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { SandboxItem } from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const { items } = await apiRequest<{ items: SandboxItem[] }>('/api/v1/sandbox/items', {
		accessToken: locals.session?.access_token,
		fetchFn: fetch
	});
	return { items: items.filter((item) => item.owner_id === locals.user?.id) };
};

export const actions: Actions = {
	create: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Title is required.' });

		try {
			await apiRequest('/api/v1/sandbox/items', {
				method: 'POST',
				body: JSON.stringify({ title }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	update: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const title = String(form.get('title') ?? '').trim();
		const status = String(form.get('status') ?? '');
		if (!id || !title) return fail(400, { error: 'Title is required.' });

		try {
			await apiRequest(`/api/v1/sandbox/items/${id}`, {
				method: 'PATCH',
				body: JSON.stringify({ title, status }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	delete: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing item id.' });

		try {
			await apiRequest(`/api/v1/sandbox/items/${id}`, {
				method: 'DELETE',
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
