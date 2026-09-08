<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav>
	<a href="/">Marketplace</a>
	<a href="/library">My Sandbox</a>
	<a href="/library/all">All Sandbox</a>
	{#if data.session}
		<details style="display:inline-block">
			<summary>+ New</summary>
			<a href="/agents/new">New Agent</a>
			<a href="/skills/new">New Skill</a>
			<a href="/workflows/new">New Workflow</a>
		</details>
		<form method="POST" action="/logout" style="display:inline">
			<button type="submit">Log out</button>
		</form>
	{:else}
		<a href="/login">Log in</a>
		<a href="/register">Register</a>
	{/if}
</nav>

{@render children()}
