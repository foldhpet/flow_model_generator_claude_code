<script lang="ts">
	import { enhance } from '$app/forms';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));
</script>

<h1>Agent for {data.role.name}</h1>
<p><a href="/agents">&larr; All Agents</a> &middot; <a href="/roles/{data.role.id}">View Role</a></p>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.isOwner && data.agent.status !== 'Archived'}
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
			System prompt
			<textarea name="system_prompt">{data.agent.system_prompt ?? ''}</textarea>
		</label>
		<select name="status">
			{#each ['Draft', 'Published'] as status (status)}
				<option value={status} selected={status === data.agent.status}>{status}</option>
			{/each}
		</select>
		<button type="submit">Save</button>
	</form>
	{#if data.agent.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance>
			<button type="submit">Archive</button>
		</form>
	{/if}

	<h2>Task Assignments</h2>
	{#if data.tasks.length === 0}
		<p>This Role has no Tasks yet. <a href="/roles/{data.role.id}">Add one</a>.</p>
	{:else}
		<ul>
			{#each data.tasks as task (task.id)}
				<li>
					{task.name}
					{#if data.assignedTaskIds.includes(task.id)}
						<form method="POST" action="?/unassign" use:enhance style="display:inline">
							<input type="hidden" name="task_id" value={task.id} />
							<button type="submit">Unassign</button>
						</form>
					{:else}
						<form method="POST" action="?/assign" use:enhance style="display:inline">
							<input type="hidden" name="task_id" value={task.id} />
							<button type="submit">Assign</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	<p>{data.agent.system_prompt ?? ''}</p>
	<p>Status: {data.agent.status}</p>
	{#if data.agent.status === 'Archived'}
		<p>This item is archived — clone it to resume work.</p>

		<h2>Task Assignments</h2>
		{#if data.tasks.length === 0}
			<p>This Role has no Tasks.</p>
		{:else}
			<ul>
				{#each data.tasks as task (task.id)}
					<li>
						{task.name}
						{#if data.assignedTaskIds.includes(task.id)}
							<span>(assigned)</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
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
