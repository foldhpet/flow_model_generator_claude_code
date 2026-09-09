import { createServerClient } from '@supabase/ssr';
import { type Handle, error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.requestId = event.request.headers.get('x-request-id') ?? crypto.randomUUID();

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	// getUser() re-validates the JWT against Supabase Auth rather than trusting
	// the (spoofable) cookie payload getSession() would otherwise return.
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

// US-003 AC3 (and its Epic B equivalent for Role/Task/Agent/Skill/Workflow
// authoring): anonymous direct navigation to a Sandbox-only URL redirects to
// login rather than rendering the page or 500ing.
const AUTHORING_PREFIXES = [
	'/sandbox',
	'/roles',
	'/tasks',
	'/agents',
	'/skills',
	'/workflows',
	'/settings',
	'/moderation'
];

const sandboxGuard: Handle = async ({ event, resolve }) => {
	if (AUTHORING_PREFIXES.some((p) => event.url.pathname.startsWith(p)) && !event.locals.session) {
		throw redirect(303, '/login?reason=sandbox');
	}
	return resolve(event);
};

// Epic J (US-044/046): /moderation is authoring-gated by sandboxGuard above
// (logged-in required), and additionally restricted to is_moderator here —
// a manually-set DB flag with no self-service elevation UI, so this is the
// only place that can ever grant access.
const moderationGuard: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/moderation') && event.locals.user) {
		const { data } = await event.locals.supabase
			.from('profiles')
			.select('is_moderator')
			.eq('id', event.locals.user.id)
			.single();
		if (!data?.is_moderator) throw error(403, 'Moderators only');
	}
	return resolve(event);
};

export const handle: Handle = sequence(supabaseHandle, sandboxGuard, moderationGuard);
