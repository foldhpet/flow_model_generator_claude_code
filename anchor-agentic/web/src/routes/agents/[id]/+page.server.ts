import { error, fail, redirect } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type {
	Agent,
	AgentTaskAssignment,
	CloneResult,
	Provenance,
	Role,
	Task,
	VersionSnapshot
} from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

const VERSIONS_PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const accessToken = locals.session?.access_token;
	const versionsPage = Math.max(1, Number.parseInt(url.searchParams.get('vpage') ?? '1', 10) || 1);
	try {
		const { agent } = await apiRequest<{ agent: Agent }>(`/api/v1/agents/${params.id}`, {
			accessToken,
			fetchFn: fetch
		});
		const [{ role }, { tasks }, { assignments }, { versions, total: versionsTotal }, { provenance, cloneCount }] =
			await Promise.all([
				apiRequest<{ role: Role }>(`/api/v1/roles/${agent.role_id}`, { accessToken, fetchFn: fetch }),
				apiRequest<{ tasks: Task[] }>(`/api/v1/tasks?role_id=${agent.role_id}`, { accessToken, fetchFn: fetch }),
				apiRequest<{ assignments: AgentTaskAssignment[] }>(`/api/v1/agents/${params.id}/tasks`, {
					accessToken,
					fetchFn: fetch
				}),
				apiRequest<{ versions: VersionSnapshot[]; total: number }>(
					`/api/v1/library/AGENT/${params.id}/versions?page=${versionsPage}&pageSize=${VERSIONS_PAGE_SIZE}`,
					{ accessToken, fetchFn: fetch }
				),
				apiRequest<{ provenance: Provenance | null; cloneCount: number }>(`/api/v1/clone/AGENT/${params.id}`, {
					accessToken,
					fetchFn: fetch
				})
			]);
		const assignedTaskIds = new Set(assignments.map((a) => a.task_id));
		return {
			agent,
			role,
			tasks,
			assignedTaskIds: [...assignedTaskIds],
			isOwner: agent.owner_id === locals.user?.id,
			versions,
			versionsTotal,
			versionsPage,
			versionsPageSize: VERSIONS_PAGE_SIZE,
			provenance,
			cloneCount
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) throw error(404, 'Agent not found');
		throw err;
	}
};

export const actions: Actions = {
	update: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const systemPrompt = String(form.get('system_prompt') ?? '');

		try {
			await apiRequest(`/api/v1/agents/${params.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ system_prompt: systemPrompt }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	publish: async ({ params, locals, fetch }) => {
		try {
			await apiRequest(`/api/v1/publish/AGENT/${params.id}`, {
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

	archive: async ({ params, locals, fetch }) => {
		try {
			await apiRequest(`/api/v1/agents/${params.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ status: 'Archived' }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	assign: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const taskId = String(form.get('task_id') ?? '');
		if (!taskId) return fail(400, { error: 'Missing task id.' });

		try {
			await apiRequest(`/api/v1/agents/${params.id}/tasks/${taskId}`, {
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

	unassign: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const taskId = String(form.get('task_id') ?? '');
		if (!taskId) return fail(400, { error: 'Missing task id.' });

		try {
			await apiRequest(`/api/v1/agents/${params.id}/tasks/${taskId}`, {
				method: 'DELETE',
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	clone: async ({ params, locals, fetch }) => {
		let cloned: CloneResult;
		try {
			({ cloned } = await apiRequest<{ cloned: CloneResult }>(`/api/v1/clone/AGENT/${params.id}`, {
				method: 'POST',
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			}));
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		throw redirect(303, `/agents/${cloned.id}`);
	}
};
