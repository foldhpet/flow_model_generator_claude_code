import { fail, redirect } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { Workflow } from '$lib/api/types';
import type { Actions } from './$types';

export const actions: Actions = {
	create: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required.' });

		let created: { workflow: Workflow };
		try {
			created = await apiRequest<{ workflow: Workflow }>('/api/v1/workflows', {
				method: 'POST',
				body: JSON.stringify({ name, description: description || null }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		throw redirect(303, `/workflows/${created.workflow.id}`);
	}
};
