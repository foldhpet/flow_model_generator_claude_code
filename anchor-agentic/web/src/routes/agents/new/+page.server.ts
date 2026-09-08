import { fail, redirect } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { Agent, Role } from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const accessToken = locals.session?.access_token;
	const [{ roles }, { agents }] = await Promise.all([
		apiRequest<{ roles: Role[] }>('/api/v1/roles', { accessToken, fetchFn: fetch }),
		apiRequest<{ agents: Agent[] }>('/api/v1/agents', { accessToken, fetchFn: fetch })
	]);
	const myRoles = roles.filter((role) => role.owner_id === locals.user?.id);
	const rolesWithAgent = new Set(agents.filter((a) => a.owner_id === locals.user?.id).map((a) => a.role_id));
	return { availableRoles: myRoles.filter((role) => !rolesWithAgent.has(role.id)) };
};

export const actions: Actions = {
	create: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const roleId = String(form.get('role_id') ?? '');
		const systemPrompt = String(form.get('system_prompt') ?? '').trim();
		if (!roleId) return fail(400, { error: 'Select a Role for this Agent.' });

		let created: { agent: Agent };
		try {
			created = await apiRequest<{ agent: Agent }>('/api/v1/agents', {
				method: 'POST',
				body: JSON.stringify({ role_id: roleId, system_prompt: systemPrompt || null }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		throw redirect(303, `/agents/${created.agent.id}`);
	}
};
