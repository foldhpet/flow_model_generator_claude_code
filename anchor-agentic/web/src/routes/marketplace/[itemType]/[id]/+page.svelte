<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let displayName = $derived(
		data.itemType === 'AGENT' ? `Agent for ${data.item.role_name}` : data.item.name
	);
</script>

<h1>{displayName}</h1>
<p><a href="/">&larr; Back to Marketplace</a> &middot; <span>[{data.itemType}]</span></p>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}
{#if form?.reported}
	<p role="status">Report submitted — thank you. This item is now pending review.</p>
{/if}

{#if data.item.description}<p>{data.item.description}</p>{/if}

<p>Published version: v{data.item.published_version}</p>
{#if data.item.rating_count === 0}
	<p>Not yet rated</p>
{:else}
	<p>Rating: {data.item.rating?.toFixed(1)}/5 ({data.item.rating_count} rating{data.item.rating_count === 1 ? '' : 's'})</p>
{/if}

{#if data.isRegistered}
	<form method="POST" action="?/rate" use:enhance>
		<label>
			Your rating:
			<select name="score">
				{#each [1, 2, 3, 4, 5] as value (value)}
					<option value={value} selected={data.myRating === value}>{value}</option>
				{/each}
			</select>
		</label>
		<button type="submit">Rate</button>
	</form>
{/if}

{#if data.provenance}
	<p>
		Cloned from
		{#if data.provenance.source_name}
			{data.provenance.source_name}
		{:else}
			a since-removed item
		{/if}
	</p>
{/if}

{#if data.isRegistered}
	<form method="POST" action="?/clone" use:enhance>
		<button type="submit">Clone into My Sandbox</button>
	</form>
{/if}

<p>Cloned {data.item.clone_count} times</p>

<h2>Report this item</h2>
<form method="POST" action="?/report" use:enhance>
	<label>
		Reason:
		<select name="reason" required>
			<option value="ABUSIVE">Abusive content</option>
			<option value="BROKEN">Broken / doesn't work</option>
			<option value="SPAM">Spam</option>
			<option value="OTHER">Other</option>
		</select>
	</label>
	<label>
		Details (optional):
		<textarea name="detail" maxlength="2000"></textarea>
	</label>
	<button type="submit">Report</button>
</form>

{#if data.itemType === 'AGENT'}
	<h2>Task Assignments</h2>
	{#if !data.assignments || data.assignments.length === 0}
		<p>No Tasks assigned.</p>
	{:else}
		<ul>
			{#each data.assignments as assignment (assignment.id)}
				<li>{assignment.tasks?.name ?? assignment.task_id}</li>
			{/each}
		</ul>
	{/if}
{:else if data.itemType === 'SKILL'}
	<h2>Skill Files</h2>
	<ul>
		{#each data.item.skill_files ?? [] as file (file.path)}
			<li>
				<strong>{file.path}</strong>
				<pre>{file.content}</pre>
			</li>
		{/each}
	</ul>
{:else if data.itemType === 'WORKFLOW'}
	<h2>Steps</h2>
	<ol>
		{#each data.steps ?? [] as step (step.id)}
			<li>[{step.step_type}] {step.label}</li>
		{/each}
	</ol>
{/if}
