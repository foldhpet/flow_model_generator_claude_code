import { error, fail, redirect } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type {
	Agent,
	CloneResult,
	Provenance,
	Role,
	Skill,
	Task,
	VersionSnapshot,
	Workflow,
	WorkflowStep,
	WorkflowStepType
} from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

const VERSIONS_PAGE_SIZE = 10;

function referenceable<T extends { owner_id: string; status: string }>(items: T[], userId: string | undefined) {
	return items.filter((item) => item.owner_id === userId || item.status === 'Published');
}

export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const accessToken = locals.session?.access_token;
	const versionsPage = Math.max(1, Number.parseInt(url.searchParams.get('vpage') ?? '1', 10) || 1);
	try {
		const { workflow } = await apiRequest<{ workflow: Workflow }>(`/api/v1/workflows/${params.id}`, {
			accessToken,
			fetchFn: fetch
		});
		const [
			{ steps },
			{ tasks },
			{ agents },
			{ skills },
			{ roles },
			{ versions, total: versionsTotal },
			{ provenance, cloneCount }
		] = await Promise.all([
			apiRequest<{ steps: WorkflowStep[] }>(`/api/v1/workflows/${params.id}/steps`, {
				accessToken,
				fetchFn: fetch
			}),
			apiRequest<{ tasks: Task[] }>('/api/v1/tasks', { accessToken, fetchFn: fetch }),
			apiRequest<{ agents: Agent[] }>('/api/v1/agents', { accessToken, fetchFn: fetch }),
			apiRequest<{ skills: Skill[] }>('/api/v1/skills', { accessToken, fetchFn: fetch }),
			apiRequest<{ roles: Role[] }>('/api/v1/roles', { accessToken, fetchFn: fetch }),
			apiRequest<{ versions: VersionSnapshot[]; total: number }>(
				`/api/v1/library/WORKFLOW/${params.id}/versions?page=${versionsPage}&pageSize=${VERSIONS_PAGE_SIZE}`,
				{ accessToken, fetchFn: fetch }
			),
			apiRequest<{ provenance: Provenance | null; cloneCount: number }>(`/api/v1/clone/WORKFLOW/${params.id}`, {
				accessToken,
				fetchFn: fetch
			})
		]);

		const taskById = new Map(tasks.map((t) => [t.id, t]));
		const agentById = new Map(agents.map((a) => [a.id, a]));
		const skillById = new Map(skills.map((s) => [s.id, s]));
		const roleById = new Map(roles.map((r) => [r.id, r]));

		const describeStep = (step: WorkflowStep) => {
			if (step.step_type === 'TASK' && step.task_id) return taskById.get(step.task_id)?.name ?? step.task_id;
			if (step.step_type === 'AGENT' && step.agent_id) {
				const agent = agentById.get(step.agent_id);
				return agent ? `Agent for ${roleById.get(agent.role_id)?.name ?? agent.role_id}` : step.agent_id;
			}
			if (step.step_type === 'SKILL' && step.skill_id) return skillById.get(step.skill_id)?.name ?? step.skill_id;
			return '';
		};

		return {
			workflow,
			steps: steps.map((step) => ({ ...step, label: describeStep(step) })),
			isOwner: workflow.owner_id === locals.user?.id,
			referenceOptions: {
				TASK: referenceable(tasks, locals.user?.id).map((t) => ({ id: t.id, label: t.name })),
				AGENT: referenceable(agents, locals.user?.id).map((a) => ({
					id: a.id,
					label: `Agent for ${roleById.get(a.role_id)?.name ?? a.role_id}`
				})),
				SKILL: referenceable(skills, locals.user?.id).map((s) => ({ id: s.id, label: s.name }))
			},
			versions,
			versionsTotal,
			versionsPage,
			versionsPageSize: VERSIONS_PAGE_SIZE,
			provenance,
			cloneCount
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) throw error(404, 'Workflow not found');
		throw err;
	}
};

function referenceBody(stepType: string, referenceId: string) {
	return {
		step_type: stepType,
		task_id: stepType === 'TASK' ? referenceId : null,
		agent_id: stepType === 'AGENT' ? referenceId : null,
		skill_id: stepType === 'SKILL' ? referenceId : null
	};
}

export const actions: Actions = {
	update: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required.' });

		try {
			await apiRequest(`/api/v1/workflows/${params.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ name, description }),
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
			await apiRequest(`/api/v1/publish/WORKFLOW/${params.id}`, {
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
			await apiRequest(`/api/v1/workflows/${params.id}`, {
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

	addStep: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const stepType = String(form.get('step_type') ?? '') as WorkflowStepType;
		const referenceId = String(form.get('reference_id') ?? '');
		if (!referenceId) return fail(400, { error: 'Select an item for this step.' });

		try {
			await apiRequest(`/api/v1/workflows/${params.id}/steps`, {
				method: 'POST',
				body: JSON.stringify(referenceBody(stepType, referenceId)),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	editStep: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const stepId = String(form.get('step_id') ?? '');
		const stepType = String(form.get('step_type') ?? '') as WorkflowStepType;
		const referenceId = String(form.get('reference_id') ?? '');
		if (!stepId || !referenceId) return fail(400, { error: 'Select an item for this step.' });

		try {
			await apiRequest(`/api/v1/workflows/${params.id}/steps/${stepId}`, {
				method: 'PATCH',
				body: JSON.stringify(referenceBody(stepType, referenceId)),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { success: true };
	},

	removeStep: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const stepId = String(form.get('step_id') ?? '');
		if (!stepId) return fail(400, { error: 'Missing step id.' });

		try {
			await apiRequest(`/api/v1/workflows/${params.id}/steps/${stepId}`, {
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

	move: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const stepId = String(form.get('step_id') ?? '');
		const direction = String(form.get('direction') ?? '');
		const accessToken = locals.session?.access_token;

		const { steps } = await apiRequest<{ steps: WorkflowStep[] }>(`/api/v1/workflows/${params.id}/steps`, {
			accessToken,
			fetchFn: fetch
		});
		const ids = steps.map((s) => s.id);
		const index = ids.indexOf(stepId);
		const swapWith = direction === 'up' ? index - 1 : index + 1;
		if (index === -1 || swapWith < 0 || swapWith >= ids.length) return { success: true };
		[ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];

		try {
			await apiRequest(`/api/v1/workflows/${params.id}/steps/reorder`, {
				method: 'PUT',
				body: JSON.stringify({ step_ids: ids }),
				accessToken,
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
			({ cloned } = await apiRequest<{ cloned: CloneResult }>(`/api/v1/clone/WORKFLOW/${params.id}`, {
				method: 'POST',
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			}));
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		throw redirect(303, `/workflows/${cloned.id}`);
	}
};
