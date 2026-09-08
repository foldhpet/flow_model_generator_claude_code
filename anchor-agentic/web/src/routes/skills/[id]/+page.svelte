<script lang="ts">
	import { enhance } from '$app/forms';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let files = $state(data.skill.skill_files.map((f) => ({ ...f })));

	$effect(() => {
		files = data.skill.skill_files.map((f) => ({ ...f }));
	});

	function addFile() {
		files.push({ path: '', content: '' });
	}

	function removeFile(index: number) {
		files.splice(index, 1);
	}

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));
</script>

<h1>{data.skill.name}</h1>
<p><a href="/skills">&larr; All Skills</a></p>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.provenance}
	<p>
		Cloned from
		{#if data.provenance.source_name}
			<a href="/skills/{data.provenance.source_item_id}">{data.provenance.source_name}</a>
		{:else}
			a since-removed item
		{/if}
	</p>
{/if}

{#if data.skill.status === 'Published'}
	<form method="POST" action="?/clone" use:enhance>
		<button type="submit">Clone into My Sandbox</button>
	</form>
{/if}

{#if data.isOwner}
	<p>Cloned {data.cloneCount} times</p>
{/if}

{#if data.isOwner && data.skill.status !== 'Archived'}
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
			<input name="name" value={data.skill.name} required />
		</label>
		<label>
			Description
			<input name="description" value={data.skill.description ?? ''} />
		</label>

		<h2>Skill files</h2>
		{#each files as file, index (index)}
			<fieldset>
				<label>
					Path
					<input bind:value={file.path} placeholder="SKILL.md" />
				</label>
				<label>
					Content
					<textarea bind:value={file.content}></textarea>
				</label>
				<button type="button" onclick={() => removeFile(index)}>Remove file</button>
			</fieldset>
		{/each}
		<button type="button" onclick={addFile}>+ Add file</button>
		<input type="hidden" name="skill_files" value={JSON.stringify(files)} />

		<p>Status: {data.skill.status}</p>
		<button type="submit">Save</button>
	</form>
	{#if data.skill.published_version == null}
		<p>No published version yet.</p>
	{:else}
		<p>Published at v{data.skill.published_version}.</p>
	{/if}
	{#if data.skill.published_version == null || data.skill.current_version > data.skill.published_version}
		<form method="POST" action="?/publish" use:enhance>
			<button type="submit">{data.skill.published_version == null ? 'Publish' : 'Re-publish'}</button>
		</form>
	{/if}
	{#if data.skill.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance>
			<button type="submit">Archive</button>
		</form>
	{/if}
{:else}
	<p>{data.skill.description ?? ''}</p>
	<p>Status: {data.skill.status}</p>
	{#if data.skill.status === 'Archived'}
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
