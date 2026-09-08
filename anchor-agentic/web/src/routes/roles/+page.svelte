<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>Roles</h1>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

<form method="POST" action="?/create" use:enhance>
	<label>
		Name
		<input name="name" required />
	</label>
	<label>
		Description
		<input name="description" />
	</label>
	<button type="submit">Create Role</button>
</form>

{#if data.roles.length === 0}
	<p>You haven't created any Roles yet.</p>
{:else}
	<ul>
		{#each data.roles as role (role.id)}
			<li>
				<a href="/roles/{role.id}">{role.name}</a> — {role.status} (v{role.current_version})
			</li>
		{/each}
	</ul>
{/if}
