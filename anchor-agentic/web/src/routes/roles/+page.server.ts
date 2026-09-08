import { fail } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { Role } from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const { roles } = await apiRequest<{ roles: Role[] }>('/api/v1/roles', {
		accessToken: locals.session?.access_token,
		fetchFn: fetch
	});
	return { roles: roles.filter((role) => role.owner_id === locals.user?.id) };
};

export const actions: Actions = {
	create: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required.' });

		try {
			await apiRequest('/api/v1/roles', {
				method: 'POST',
				body: JSON.stringify({ name, description: description || null }),
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
