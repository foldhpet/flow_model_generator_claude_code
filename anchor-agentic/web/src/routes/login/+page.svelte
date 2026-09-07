<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>Log in</h1>

{#if data.reason === 'sandbox'}
	<p role="alert">Register or log in to continue to the Sandbox.</p>
{:else if data.reason === 'expired'}
	<p role="alert">Your session expired. Please log in again.</p>
{/if}

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

<form method="POST">
	<label>
		Email
		<input type="email" name="email" required autocomplete="email" />
	</label>
	<label>
		Password
		<input type="password" name="password" required autocomplete="current-password" />
	</label>
	<button type="submit">Log in</button>
</form>

<p>Don't have an account? <a href="/register">Register</a></p>
