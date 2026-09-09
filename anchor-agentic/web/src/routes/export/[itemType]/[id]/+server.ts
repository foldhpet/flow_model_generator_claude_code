import { error, json } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { ExportFile, MarketplaceItemType } from '$lib/api/types';
import type { RequestHandler } from './$types';

const VALID_ITEM_TYPES: MarketplaceItemType[] = ['AGENT', 'SKILL', 'WORKFLOW'];

// US-037: same-origin proxy so the Bearer token stays server-side — the
// browser calls this route, this route calls the Worker API, never the
// other way around.
export const GET: RequestHandler = async ({ params, locals, fetch }) => {
	const itemType = params.itemType as MarketplaceItemType;
	if (!VALID_ITEM_TYPES.includes(itemType)) throw error(400, 'Invalid item type');

	try {
		const result = await apiRequest<{ files: ExportFile[] }>('/api/v1/export', {
			method: 'POST',
			body: JSON.stringify({ item_type: itemType, item_id: params.id, target: 'zip' }),
			accessToken: locals.session?.access_token,
			fetchFn: fetch
		});
		return json(result);
	} catch (err) {
		if (err instanceof ApiError) throw error(err.status, err.message);
		throw err;
	}
};
