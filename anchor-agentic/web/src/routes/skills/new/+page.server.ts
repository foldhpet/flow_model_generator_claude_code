import { fail, redirect } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { Skill } from '$lib/api/types';
import type { Actions } from './$types';

export const actions: Actions = {
	create: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const skillFilesRaw = String(form.get('skill_files') ?? '[]');
		if (!name) return fail(400, { error: 'Name is required.' });

		let skillFiles: unknown;
		try {
			skillFiles = JSON.parse(skillFilesRaw);
		} catch {
			skillFiles = [];
		}

		let created: { skill: Skill };
		try {
			created = await apiRequest<{ skill: Skill }>('/api/v1/skills', {
				method: 'POST',
				body: JSON.stringify({ name, description: description || null, skill_files: skillFiles }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		throw redirect(303, `/skills/${created.skill.id}`);
	}
};
