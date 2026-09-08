<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<h1>New Workflow</h1>

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
	<button type="submit">Create Workflow</button>
</form>
