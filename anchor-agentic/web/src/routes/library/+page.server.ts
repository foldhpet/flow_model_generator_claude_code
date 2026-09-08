import { apiRequest } from '$lib/api/client';
import type { LibraryItem } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const { items } = await apiRequest<{ items: LibraryItem[]; total: number }>(
		'/api/v1/library?scope=mine&pageSize=200',
		{ accessToken: locals.session?.access_token, fetchFn: fetch }
	);
	return { items };
};
