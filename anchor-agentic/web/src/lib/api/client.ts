import { PUBLIC_API_URL } from '$env/static/public';

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

type RequestOptions = RequestInit & {
	accessToken?: string | null;
	fetchFn?: typeof fetch;
};

// Thin wrapper around the API Worker: attaches the caller's Supabase access
// token as a Bearer header and normalizes 401s (expired/missing session) and
// other non-2xx responses into ApiError so callers can branch on `.status`.
export async function apiRequest<T>(
	path: string,
	{ accessToken, fetchFn = fetch, ...init }: RequestOptions = {}
): Promise<T> {
	const headers = new Headers(init.headers);
	if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
	if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

	const res = await fetchFn(`${PUBLIC_API_URL}${path}`, { ...init, headers });

	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		throw new ApiError(res.status, body.error ?? 'request_failed');
	}
	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}
