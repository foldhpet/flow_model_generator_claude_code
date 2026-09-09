import { error, fail, redirect } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type {
	AgentTaskAssignment,
	CloneResult,
	MarketplaceItemDetail,
	MarketplaceItemType,
	MarketplaceWorkflowStep,
	Provenance
} from '$lib/api/types';
import type { Actions, PageServerLoad } from './$types';

const DETAIL_ROUTE: Record<MarketplaceItemType, string> = {
	AGENT: '/agents',
	SKILL: '/skills',
	WORKFLOW: '/workflows'
};

// US-027: public detail read (no requireAuth on the API side) plus, only
// for registered users, the existing clone/:itemType/:id provenance+count
// lookup (that endpoint itself requires auth) — anonymous visitors get
// neither provenance nor a Clone control (AC4).
export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const itemType = params.itemType as MarketplaceItemType;

	try {
		const detail = await apiRequest<{
			item: MarketplaceItemDetail;
			assignments?: AgentTaskAssignment[];
			steps?: MarketplaceWorkflowStep[];
			myRating: number | null;
		}>(`/api/v1/marketplace/items/${itemType}/${params.id}`, { fetchFn: fetch });

		let provenance: Provenance | null = null;
		let cloneCount = 0;
		if (locals.user) {
			({ provenance, cloneCount } = await apiRequest<{ provenance: Provenance | null; cloneCount: number }>(
				`/api/v1/clone/${itemType}/${params.id}`,
				{ accessToken: locals.session?.access_token, fetchFn: fetch }
			));
		}

		return { itemType, ...detail, provenance, cloneCount, isRegistered: !!locals.user };
	} catch (err) {
		if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
			throw error(404, 'Item not found');
		}
		throw err;
	}
};

export const actions: Actions = {
	clone: async ({ params, locals, fetch }) => {
		const itemType = params.itemType as MarketplaceItemType;
		let cloned: CloneResult;
		try {
			({ cloned } = await apiRequest<{ cloned: CloneResult }>(`/api/v1/clone/${itemType}/${params.id}`, {
				method: 'POST',
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			}));
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		throw redirect(303, `${DETAIL_ROUTE[cloned.item_type]}/${cloned.id}`);
	},

	// US-030: registered users only (route is behind requireAuth on the API
	// side); resubmitting a score updates the rater's existing row rather
	// than duplicating it (AC1/AC2), enforced by the API's upsert.
	rate: async ({ request, params, locals, fetch }) => {
		const itemType = params.itemType as MarketplaceItemType;
		const form = await request.formData();
		const score = Number.parseInt(String(form.get('score') ?? ''), 10);

		try {
			await apiRequest(`/api/v1/marketplace/items/${itemType}/${params.id}/rating`, {
				method: 'POST',
				body: JSON.stringify({ score }),
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
