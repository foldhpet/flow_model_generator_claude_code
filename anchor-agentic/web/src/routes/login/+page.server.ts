import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const loginSchema = z.object({
	email: z.string().trim().email('Enter a valid email address.'),
	password: z.string().min(1, 'Enter your password.')
});

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.session) throw redirect(303, '/');
	return { reason: url.searchParams.get('reason') };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const parsed = loginSchema.safeParse({
			email: form.get('email'),
			password: form.get('password')
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
		}

		const { error } = await locals.supabase.auth.signInWithPassword(parsed.data);
		if (error) {
			// Deliberately vague — don't reveal whether the email is registered.
			return fail(400, { error: 'Invalid email or password.' });
		}

		throw redirect(303, '/');
	}
};
