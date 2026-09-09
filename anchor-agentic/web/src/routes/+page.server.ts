import { apiRequest } from '$lib/api/client';
import type { MarketplaceListItem } from '$lib/api/types';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 20;

// Marketplace root listing — public, anonymous-readable (US-026 AC1).
// Mirrors library/all/+page.server.ts's param-building; adds the `role`
// filter (US-028 AC3) on top of `q`/`type`.
export const load: PageServerLoad = async ({ url, fetch }) => {
	const q = url.searchParams.get('q') ?? '';
	const type = url.searchParams.get('type') ?? '';
	const role = url.searchParams.get('role') ?? '';
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
	if (q) params.set('q', q);
	if (type) params.set('type', type);
	if (role) params.set('role', role);

	const { items, total } = await apiRequest<{ items: MarketplaceListItem[]; total: number }>(
		`/api/v1/marketplace/items?${params.toString()}`,
		{ fetchFn: fetch }
	);

	return { items, total, page, pageSize: PAGE_SIZE, q, type, role };
};
