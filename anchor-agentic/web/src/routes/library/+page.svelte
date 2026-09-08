<script lang="ts">
	import type { LibraryItem, LibraryItemType } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let showArchived = $state(false);

	const DETAIL_ROUTE: Record<LibraryItemType, string> = {
		ROLE: '/roles',
		TASK: '/tasks',
		AGENT: '/agents',
		SKILL: '/skills',
		WORKFLOW: '/workflows'
	};

	const TYPE_LABEL: Record<LibraryItemType, string> = {
		ROLE: 'Roles',
		TASK: 'Tasks',
		AGENT: 'Agents',
		SKILL: 'Skills',
		WORKFLOW: 'Workflows'
	};

	const ORDER: LibraryItemType[] = ['ROLE', 'TASK', 'AGENT', 'SKILL', 'WORKFLOW'];

	function displayName(item: LibraryItem) {
		return item.item_type === 'AGENT' ? `Agent for ${item.name}` : item.name;
	}

	let visibleItems = $derived(data.items.filter((item) => showArchived || item.status !== 'Archived'));
	let grouped = $derived(
		ORDER.map((type) => ({
			type,
			items: visibleItems.filter((item: LibraryItem) => item.item_type === type)
		})).filter((group) => group.items.length > 0)
	);
</script>

<h1>My Library</h1>

<label>
	<input type="checkbox" bind:checked={showArchived} />
	Show archived
</label>

{#if data.items.length === 0}
	<p>You haven't created anything yet.</p>
	<p>
		<a href="/roles">+ New Role</a> · <a href="/agents/new">+ New Agent</a> ·
		<a href="/skills/new">+ New Skill</a> · <a href="/workflows/new">+ New Workflow</a>
	</p>
{:else if grouped.length === 0}
	<p>No items to show. Uncheck "show archived" or create something new.</p>
{:else}
	{#each grouped as group (group.type)}
		<h2>{TYPE_LABEL[group.type]}</h2>
		<ul>
			{#each group.items as item (item.id)}
				<li>
					<a href="{DETAIL_ROUTE[item.item_type]}/{item.id}">{displayName(item)}</a>
					<span>[{item.status}]</span>
				</li>
			{/each}
		</ul>
	{/each}
{/if}

<p><a href="/library/all">View All Library</a></p>
