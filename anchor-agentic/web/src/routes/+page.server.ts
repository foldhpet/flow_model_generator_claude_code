import { apiRequest } from '$lib/api/client';
import type { SandboxItem } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const { items } = await apiRequest<{ items: SandboxItem[] }>('/api/v1/marketplace/items', {
		fetchFn: fetch
	});
	return { items };
};
