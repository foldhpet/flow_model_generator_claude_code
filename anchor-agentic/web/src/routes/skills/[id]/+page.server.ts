import { error, fail } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { Skill, VersionSnapshot } from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

const VERSIONS_PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const accessToken = locals.session?.access_token;
	const versionsPage = Math.max(1, Number.parseInt(url.searchParams.get('vpage') ?? '1', 10) || 1);
	try {
		const [{ skill }, { versions, total: versionsTotal }] = await Promise.all([
			apiRequest<{ skill: Skill }>(`/api/v1/skills/${params.id}`, { accessToken, fetchFn: fetch }),
			apiRequest<{ versions: VersionSnapshot[]; total: number }>(
				`/api/v1/library/SKILL/${params.id}/versions?page=${versionsPage}&pageSize=${VERSIONS_PAGE_SIZE}`,
				{ accessToken, fetchFn: fetch }
			)
		]);
		return {
			skill,
			isOwner: skill.owner_id === locals.user?.id,
			versions,
			versionsTotal,
			versionsPage,
			versionsPageSize: VERSIONS_PAGE_SIZE
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) throw error(404, 'Skill not found');
		throw err;
	}
};

export const actions: Actions = {
	update: async ({ request, params, locals, fetch }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const status = String(form.get('status') ?? '');
		const skillFilesRaw = String(form.get('skill_files') ?? '[]');
		if (!name) return fail(400, { error: 'Name is required.' });

		let skillFiles: unknown;
		try {
			skillFiles = JSON.parse(skillFilesRaw);
		} catch {
			skillFiles = [];
		}

		try {
			await apiRequest(`/api/v1/skills/${params.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ name, description, status, skill_files: skillFiles }),
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
			await apiRequest(`/api/v1/skills/${params.id}`, {
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
