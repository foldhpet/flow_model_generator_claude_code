import { apiRequest } from '$lib/api/client';
import type { LibraryItem } from '$lib/api/types';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 20;

// All Library: every registered user can read every item regardless of
// owner or status (Sandbox items are never private) — this page is
// deliberately read-only, no edit/delete affordances regardless of
// ownership (US-017/US-018; RLS + the API's write-own boundary are what
// actually enforce it, not the absence of a button).
export const load: PageServerLoad = async ({ url, locals, fetch }) => {
	const q = url.searchParams.get('q') ?? '';
	const type = url.searchParams.get('type') ?? '';
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	const params = new URLSearchParams({ scope: 'all', page: String(page), pageSize: String(PAGE_SIZE) });
	if (q) params.set('q', q);
	if (type) params.set('type', type);

	const { items, total } = await apiRequest<{ items: LibraryItem[]; total: number }>(
		`/api/v1/library?${params.toString()}`,
		{ accessToken: locals.session?.access_token, fetchFn: fetch }
	);

	return { items, total, page, pageSize: PAGE_SIZE, q, type };
};
