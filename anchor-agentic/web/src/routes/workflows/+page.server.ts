import { apiRequest } from '$lib/api/client';
import type { Workflow } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const { workflows } = await apiRequest<{ workflows: Workflow[] }>('/api/v1/workflows', {
		accessToken: locals.session?.access_token,
		fetchFn: fetch
	});
	return { workflows: workflows.filter((wf) => wf.owner_id === locals.user?.id) };
};
