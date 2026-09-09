<script lang="ts">
	import type { MarketplaceItemType } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function displayName(item: { item_type: MarketplaceItemType; name: string | null }) {
		return item.item_type === 'AGENT' ? `Agent for ${item.name}` : item.name;
	}

	let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
</script>

<h1>Marketplace</h1>

<form method="GET">
	<label>
		Search
		<input type="search" name="q" value={data.q} placeholder="Search by name or description..." />
	</label>
	<label>
		Type
		<select name="type">
			<option value="" selected={data.type === ''}>All types</option>
			{#each ['AGENT', 'SKILL', 'WORKFLOW'] as type (type)}
				<option value={type} selected={data.type === type}>{type}</option>
			{/each}
		</select>
	</label>
	<label>
		Role
		<input type="text" name="role" value={data.role} placeholder="Filter Agents by Role..." />
	</label>
	<button type="submit">Search</button>
</form>

{#if data.items.length === 0}
	<p>No published items yet. Check back soon.</p>
{:else}
	<ul>
		{#each data.items as item (`${item.item_type}-${item.id}`)}
			<li>
				<a href="/marketplace/{item.item_type}/{item.id}">{displayName(item)}</a>
				<span>[{item.item_type}]</span>
				{#if item.description}<p>{item.description}</p>{/if}
				{#if item.rating_count === 0}
						<span>Not yet rated</span>
					{:else}
						<span>Rating: {item.rating?.toFixed(1)}/5 ({item.rating_count} rating{item.rating_count === 1 ? '' : 's'})</span>
					{/if}
					· <span>Cloned {item.clone_count} times</span>
			</li>
		{/each}
	</ul>
{/if}

{#if totalPages > 1}
	<p>
		Page {data.page} of {totalPages}
		{#if data.page > 1}
			<a href="?q={data.q}&type={data.type}&role={data.role}&page={data.page - 1}">← Prev</a>
		{/if}
		{#if data.page < totalPages}
			<a href="?q={data.q}&type={data.type}&role={data.role}&page={data.page + 1}">Next →</a>
		{/if}
	</p>
{/if}
