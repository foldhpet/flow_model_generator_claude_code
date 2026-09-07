<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav>
	<a href="/">Marketplace</a>
	<a href="/sandbox">My Sandbox</a>
	<a href="/sandbox/all">All Sandbox</a>
	{#if data.session}
		<form method="POST" action="/logout" style="display:inline">
			<button type="submit">Log out</button>
		</form>
	{:else}
		<a href="/login">Log in</a>
		<a href="/register">Register</a>
	{/if}
</nav>

{@render children()}
