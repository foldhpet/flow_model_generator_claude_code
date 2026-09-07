import { error } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { SandboxItem } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	try {
		const { item } = await apiRequest<{ item: SandboxItem }>(
			`/api/v1/marketplace/items/${params.id}`,
			{ fetchFn: fetch }
		);
		return { item };
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) {
			throw error(404, 'Item not found');
		}
		throw err;
	}
};
