<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>My Sandbox</h1>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

<form method="POST" action="?/create" use:enhance>
	<label>
		New item title
		<input name="title" required />
	</label>
	<button type="submit">Create</button>
</form>

{#if data.items.length === 0}
	<p>You haven't created any items yet.</p>
{:else}
	<ul>
		{#each data.items as item (item.id)}
			<li>
				<form method="POST" action="?/update" use:enhance style="display:inline">
					<input type="hidden" name="id" value={item.id} />
					<input name="title" value={item.title} required />
					<select name="status">
						{#each ['Draft', 'Published', 'UnderReview', 'Removed'] as status (status)}
							<option value={status} selected={status === item.status}>{status}</option>
						{/each}
					</select>
					<button type="submit">Save</button>
				</form>
				<form method="POST" action="?/delete" use:enhance style="display:inline">
					<input type="hidden" name="id" value={item.id} />
					<button type="submit">Delete</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<p><a href="/sandbox/all">View All Sandbox</a></p>
