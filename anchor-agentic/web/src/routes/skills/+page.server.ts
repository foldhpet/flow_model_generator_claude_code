import { apiRequest } from '$lib/api/client';
import type { Skill } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const { skills } = await apiRequest<{ skills: Skill[] }>('/api/v1/skills', {
		accessToken: locals.session?.access_token,
		fetchFn: fetch
	});
	return { skills: skills.filter((skill) => skill.owner_id === locals.user?.id) };
};
