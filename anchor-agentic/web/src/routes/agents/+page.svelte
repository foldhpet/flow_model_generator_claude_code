<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Agents</h1>
<p><a href="/agents/new">+ New Agent</a></p>

{#if data.agents.length === 0}
	<p>You haven't created any Agents yet.</p>
{:else}
	<ul>
		{#each data.agents as agent (agent.id)}
			<li>
				<a href="/agents/{agent.id}">Agent for {agent.roleName}</a> — {agent.status} (v{agent.current_version})
			</li>
		{/each}
	</ul>
{/if}
