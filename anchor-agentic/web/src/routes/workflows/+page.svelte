<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Workflows</h1>
<p><a href="/workflows/new">+ New Workflow</a></p>

{#if data.workflows.length === 0}
	<p>You haven't created any Workflows yet.</p>
{:else}
	<ul>
		{#each data.workflows as workflow (workflow.id)}
			<li>
				<a href="/workflows/{workflow.id}">{workflow.name}</a> — {workflow.status} (v{workflow.current_version})
			</li>
		{/each}
	</ul>
{/if}
