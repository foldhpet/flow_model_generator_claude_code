<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let files = $state<{ path: string; content: string }[]>([{ path: '', content: '' }]);

	function addFile() {
		files.push({ path: '', content: '' });
	}

	function removeFile(index: number) {
		files.splice(index, 1);
	}
</script>

<h1>New Skill</h1>

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
	<button type="submit">Create Skill</button>
</form>
