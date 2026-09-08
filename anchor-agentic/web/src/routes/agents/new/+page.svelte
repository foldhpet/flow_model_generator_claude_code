<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>New Agent</h1>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.availableRoles.length === 0}
	<p>All of your Roles already have an Agent. <a href="/roles">Create a new Role</a> first.</p>
{:else}
	<form method="POST" action="?/create" use:enhance>
		<label>
			Role
			<select name="role_id" required>
				{#each data.availableRoles as role (role.id)}
					<option value={role.id}>{role.name}</option>
				{/each}
			</select>
		</label>
		<label>
			System prompt
			<textarea name="system_prompt"></textarea>
		</label>
		<button type="submit">Create Agent</button>
	</form>
{/if}

<p><a href="/roles">+ New Role</a></p>
