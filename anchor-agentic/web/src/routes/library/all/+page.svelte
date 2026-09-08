<script lang="ts">
	import type { LibraryItemType } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const DETAIL_ROUTE: Record<LibraryItemType, string> = {
		ROLE: '/roles',
		TASK: '/tasks',
		AGENT: '/agents',
		SKILL: '/skills',
		WORKFLOW: '/workflows'
	};

	function displayName(item: { item_type: LibraryItemType; name: string }) {
		return item.item_type === 'AGENT' ? `Agent for ${item.name}` : item.name;
	}

	let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
</script>

<h1>All Library</h1>

<form method="GET">
	<label>
		Search
		<input type="search" name="q" value={data.q} placeholder="Search by name..." />
	</label>
	<label>
		Type
		<select name="type">
			<option value="" selected={data.type === ''}>All types</option>
			{#each ['ROLE', 'TASK', 'AGENT', 'SKILL', 'WORKFLOW'] as type (type)}
				<option value={type} selected={data.type === type}>{type}</option>
			{/each}
		</select>
	</label>
	<button type="submit">Search</button>
</form>

{#if data.items.length === 0}
	<p>No items match your search.</p>
{:else}
	<ul>
		{#each data.items as item (item.id)}
			<li>
				<a href="{DETAIL_ROUTE[item.item_type]}/{item.id}">{displayName(item)}</a>
				<span>[{item.item_type}] [{item.status}]</span>
			</li>
		{/each}
	</ul>
{/if}

{#if totalPages > 1}
	<p>
		Page {data.page} of {totalPages}
		{#if data.page > 1}
			<a
				href="?q={data.q}&type={data.type}&page={data.page - 1}"
			>← Prev</a>
		{/if}
		{#if data.page < totalPages}
			<a
				href="?q={data.q}&type={data.type}&page={data.page + 1}"
			>Next →</a>
		{/if}
	</p>
{/if}

<p><a href="/library">← Back to My Library</a></p>
