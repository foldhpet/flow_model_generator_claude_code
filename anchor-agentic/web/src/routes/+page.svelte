<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Marketplace</h1>

{#if data.items.length === 0}
	<p>No published items yet. Check back soon.</p>
{:else}
	<ul>
		{#each data.items as item (item.id)}
			<li>
				<a href="/marketplace/{item.id}">{item.title}</a>
			</li>
		{/each}
	</ul>
{/if}
