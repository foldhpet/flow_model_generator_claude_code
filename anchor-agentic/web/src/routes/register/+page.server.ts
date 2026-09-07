import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const registerSchema = z.object({
	username: z
		.string()
		.trim()
		.min(3, 'Username must be at least 3 characters.')
		.max(32, 'Username must be at most 32 characters.'),
	email: z.string().trim().email('Enter a valid email address.'),
	password: z.string().min(8, 'Password must be at least 8 characters.')
});

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session) throw redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const parsed = registerSchema.safeParse({
			username: form.get('username'),
			email: form.get('email'),
			password: form.get('password')
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
		}
		const { username, email, password } = parsed.data;

		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: { data: { username } }
		});

		if (error) {
			return fail(400, { error: error.message });
		}

		// A duplicate email returns { user, session: null } with an empty
		// identities array and no thrown error — must check this explicitly.
		if (data.user && data.user.identities && data.user.identities.length === 0) {
			return fail(400, { error: 'An account with this email already exists.' });
		}
		if (!data.session) {
			return fail(400, {
				error: 'Registration succeeded but no session was started. Please log in.'
			});
		}

		throw redirect(303, '/');
	}
};
