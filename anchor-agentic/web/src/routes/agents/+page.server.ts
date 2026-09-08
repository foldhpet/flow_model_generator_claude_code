import { apiRequest } from '$lib/api/client';
import type { Agent, Role } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const accessToken = locals.session?.access_token;
	const [{ agents }, { roles }] = await Promise.all([
		apiRequest<{ agents: Agent[] }>('/api/v1/agents', { accessToken, fetchFn: fetch }),
		apiRequest<{ roles: Role[] }>('/api/v1/roles', { accessToken, fetchFn: fetch })
	]);
	const myAgents = agents.filter((agent) => agent.owner_id === locals.user?.id);
	const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
	return {
		agents: myAgents.map((agent) => ({ ...agent, roleName: roleNameById.get(agent.role_id) ?? agent.role_id }))
	};
};
