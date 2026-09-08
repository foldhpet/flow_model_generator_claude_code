import { error, fail } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { Role, Task, VersionSnapshot } from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

const VERSIONS_PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const accessToken = locals.session?.access_token;
	const versionsPage = Math.max(1, Number.parseInt(url.searchParams.get('vpage') ?? '1', 10) || 1);
	try {
		const { task } = await apiRequest<{ task: Task }>(`/api/v1/tasks/${params.id}`, {
			accessToken,
			fetchFn: fetch
		});
		const [{ role }, { versions, total: versionsTotal }] = await Promise.all([
			apiRequest<{ role: Role }>(`/api/v1/roles/${task.role_id}`, { accessToken, fetchFn: fetch }),
			apiRequest<{ versions: VersionSnapshot[]; total: number }>(
				`/api/v1/library/TASK/${params.id}/versions?page=${versionsPage}&pageSize=${VERSIONS_PAGE_SIZE}`,
				{ accessToken, fetchFn: fetch }
			)
		]);
		return {
			task,
			role,
			isOwner: task.owner_id === locals.user?.id,
			versions,
			versionsTotal,
			versionsPage,
			versionsPageSize: VERSIONS_PAGE_SIZE
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) throw error(404, 'Task not found');
		throw err;
	}
};

export const actions: Actions = {
	update: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const instructions = String(form.get('instructions') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required.' });

		try {
			await apiRequest(`/api/v1/tasks/${params.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ name, instructions }),
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
			await apiRequest(`/api/v1/tasks/${params.id}`, {
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
	}
};
