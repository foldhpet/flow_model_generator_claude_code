<script lang="ts">
	import { enhance } from '$app/forms';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { ActionData, PageProps } from './$types';

	let { data, form }: PageProps & { form: ActionData } = $props();

	let addStepType = $state<'TASK' | 'AGENT' | 'SKILL'>('TASK');
	let editingStepId = $state<string | null>(null);
	let editStepType = $state<'TASK' | 'AGENT' | 'SKILL'>('TASK');

	function startEdit(stepId: string, stepType: 'TASK' | 'AGENT' | 'SKILL') {
		editingStepId = stepId;
		editStepType = stepType;
	}

	let canEdit = $derived(data.isOwner && data.workflow.status !== 'Archived');

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));
</script>

<h1>{data.workflow.name}</h1>
<p><a href="/workflows">← Back to Workflows</a></p>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.provenance}
	<p>
		Cloned from
		{#if data.provenance.source_name}
			<a href="/workflows/{data.provenance.source_item_id}">{data.provenance.source_name}</a>
		{:else}
			a since-removed item
		{/if}
	</p>
{/if}

{#if data.workflow.status === 'Published'}
	<form method="POST" action="?/clone" use:enhance>
		<button type="submit">Clone into My Sandbox</button>
	</form>
{/if}

{#if data.isOwner}
	<p>Cloned {data.cloneCount} times</p>
{/if}

{#if canEdit}
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
			<input name="name" value={data.workflow.name} required />
		</label>
		<label>
			Description
			<input name="description" value={data.workflow.description ?? ''} />
		</label>
		<p>Status: {data.workflow.status}</p>
		<button type="submit">Save</button>
	</form>
	{#if data.workflow.published_version == null}
		<p>No published version yet.</p>
	{:else}
		<p>Published at v{data.workflow.published_version}.</p>
	{/if}
	{#if data.workflow.published_version == null || data.workflow.current_version > data.workflow.published_version}
		<form method="POST" action="?/publish" use:enhance>
			<button type="submit">{data.workflow.published_version == null ? 'Publish' : 'Re-publish'}</button>
		</form>
	{/if}
	{#if data.workflow.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance>
			<button type="submit">Archive</button>
		</form>
	{/if}
{:else}
	<p>{data.workflow.description}</p>
	<p>Status: {data.workflow.status}</p>
	{#if data.workflow.status === 'Archived'}
		<p>This item is archived — clone it to resume work.</p>
	{/if}
{/if}

<h2>Steps (v{data.workflow.current_version})</h2>

{#if data.steps.length === 0}
	<p>No steps yet.</p>
{:else}
	<ol>
		{#each data.steps as step, i (step.id)}
			<li>
				{#if editingStepId === step.id}
					<form method="POST" action="?/editStep" use:enhance onsubmit={() => (editingStepId = null)}>
						<input type="hidden" name="step_id" value={step.id} />
						<select name="step_type" bind:value={editStepType}>
							<option value="TASK">Task</option>
							<option value="AGENT">Agent</option>
							<option value="SKILL">Skill</option>
						</select>
						<select name="reference_id">
							{#each data.referenceOptions[editStepType] as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
						<button type="submit">Save</button>
						<button type="button" onclick={() => (editingStepId = null)}>Cancel</button>
					</form>
				{:else}
					<strong>{step.step_type}</strong>: {step.label}
					{#if canEdit}
						<form method="POST" action="?/move" use:enhance style="display:inline">
							<input type="hidden" name="step_id" value={step.id} />
							<input type="hidden" name="direction" value="up" />
							<button type="submit" disabled={i === 0}>↑</button>
						</form>
						<form method="POST" action="?/move" use:enhance style="display:inline">
							<input type="hidden" name="step_id" value={step.id} />
							<input type="hidden" name="direction" value="down" />
							<button type="submit" disabled={i === data.steps.length - 1}>↓</button>
						</form>
						<button type="button" onclick={() => startEdit(step.id, step.step_type)}>Edit</button>
						<form method="POST" action="?/removeStep" use:enhance style="display:inline">
							<input type="hidden" name="step_id" value={step.id} />
							<button type="submit">Remove</button>
						</form>
					{/if}
				{/if}
			</li>
		{/each}
	</ol>
{/if}

{#if canEdit}
	<h3>Add Step</h3>
	<form method="POST" action="?/addStep" use:enhance>
		<select name="step_type" bind:value={addStepType}>
			<option value="TASK">Task</option>
			<option value="AGENT">Agent</option>
			<option value="SKILL">Skill</option>
		</select>
		{#if data.referenceOptions[addStepType].length === 0}
			<p>No referenceable {addStepType.toLowerCase()}s available yet.</p>
		{:else}
			<select name="reference_id">
				{#each data.referenceOptions[addStepType] as option (option.id)}
					<option value={option.id}>{option.label}</option>
				{/each}
			</select>
			<button type="submit">Add Step</button>
		{/if}
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
				<a href="?vpage={data.versionsPage - 1}">← Prev</a>
			{/if}
			{#if data.versionsPage < versionsTotalPages}
				<a href="?vpage={data.versionsPage + 1}">Next →</a>
			{/if}
		</p>
	{/if}
{/if}
