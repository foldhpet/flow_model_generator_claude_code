<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<h1>Register</h1>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

<form method="POST">
	<label>
		Username
		<input name="username" required minlength="3" maxlength="32" autocomplete="username" />
	</label>
	<label>
		Email
		<input type="email" name="email" required autocomplete="email" />
	</label>
	<label>
		Password
		<input type="password" name="password" required minlength="8" autocomplete="new-password" />
	</label>
	<button type="submit">Create account</button>
</form>

<p>Already have an account? <a href="/login">Log in</a></p>
