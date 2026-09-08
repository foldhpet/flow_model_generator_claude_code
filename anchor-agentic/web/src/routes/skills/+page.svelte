<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Skills</h1>
<p><a href="/skills/new">+ New Skill</a></p>

{#if data.skills.length === 0}
	<p>You haven't created any Skills yet.</p>
{:else}
	<ul>
		{#each data.skills as skill (skill.id)}
			<li>
				<a href="/skills/{skill.id}">{skill.name}</a> — {skill.status} (v{skill.current_version})
			</li>
		{/each}
	</ul>
{/if}
