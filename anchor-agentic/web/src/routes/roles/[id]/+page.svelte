<script lang="ts">
	import { enhance } from '$app/forms';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));
</script>

<h1>{data.role.name}</h1>
<p><a href="/roles">&larr; All Roles</a></p>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.isOwner && data.role.status !== 'Archived'}
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
			<input name="name" value={data.role.name} required />
		</label>
		<label>
			Description
			<input name="description" value={data.role.description ?? ''} />
		</label>
		<p>Status: {data.role.status}</p>
		<button type="submit">Save</button>
	</form>
	{#if data.role.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance>
			<button type="submit">Archive</button>
		</form>
	{/if}
{:else}
	<p>{data.role.description ?? ''}</p>
	<p>Status: {data.role.status}</p>
	{#if data.role.status === 'Archived'}
		<p>This item is archived — clone it to resume work.</p>
	{/if}
{/if}

<h2>Tasks</h2>
{#if data.tasks.length === 0}
	<p>No Tasks under this Role yet.</p>
{:else}
	<ul>
		{#each data.tasks as task (task.id)}
			<li><a href="/tasks/{task.id}">{task.name}</a> — {task.status}</li>
		{/each}
	</ul>
{/if}

{#if data.isOwner && data.role.status !== 'Archived'}
	<h3>New Task</h3>
	<form method="POST" action="?/createTask" use:enhance>
		<label>
			Name
			<input name="name" required />
		</label>
		<label>
			Instructions
			<textarea name="instructions"></textarea>
		</label>
		<button type="submit">Create Task</button>
	</form>
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
