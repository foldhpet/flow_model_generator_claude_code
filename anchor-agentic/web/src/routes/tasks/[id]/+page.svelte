<script lang="ts">
	import { enhance } from '$app/forms';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));
</script>

<h1>{data.task.name}</h1>
<p><a href="/roles/{data.role.id}">&larr; {data.role.name}</a></p>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.isOwner && data.task.status !== 'Archived'}
	<form
		method="POST"
		action="?/update"
		use:enhance={() => {
			return async ({ update }) => {
				await update({ reset: false });
			};
		}}
	>
		<label>
			Name
			<input name="name" value={data.task.name} required />
		</label>
		<label>
			Instructions
			<textarea name="instructions">{data.task.instructions ?? ''}</textarea>
		</label>
		<label>
			Role
			<input value={data.role.name} disabled readonly />
			<span>(a Task cannot be moved to a different Role)</span>
		</label>
		<select name="status">
			{#each ['Draft', 'Published'] as status (status)}
				<option value={status} selected={status === data.task.status}>{status}</option>
			{/each}
		</select>
		<button type="submit">Save</button>
	</form>
	{#if data.task.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance>
			<button type="submit">Archive</button>
		</form>
	{/if}
{:else}
	<p>{data.task.instructions ?? ''}</p>
	<p>Role: {data.role.name}</p>
	<p>Status: {data.task.status}</p>
	{#if data.task.status === 'Archived'}
		<p>This item is archived — clone it to resume work.</p>
	{/if}
{/if}

<h2>Version History</h2>
{#if data.versions.length === 0}
	<p>No version history yet.</p>
{:else}
	<ul>
		{#each data.versions as version (version.id)}
			<li>
				<button type="button" onclick={() => (viewingVersion = version)}>
					v{version.version_number} — {version.created_at}
				</button>
			</li>
		{/each}
	</ul>
	{#if viewingVersion}
		<pre>{JSON.stringify(viewingVersion.snapshot_data, null, 2)}</pre>
		<button type="button" onclick={() => (viewingVersion = null)}>Close</button>
	{/if}
	{#if versionsTotalPages > 1}
		<p>
			Version page {data.versionsPage} of {versionsTotalPages}
			{#if data.versionsPage > 1}
				<a href="?vpage={data.versionsPage - 1}">&larr; Prev</a>
			{/if}
			{#if data.versionsPage < versionsTotalPages}
				<a href="?vpage={data.versionsPage + 1}">Next &rarr;</a>
			{/if}
		</p>
	{/if}
{/if}
