<script lang="ts">
	import type { PageData } from './$types'

	let { data, form }: { data: PageData; form: { success?: boolean; error?: string } | null } = $props()

	let showGithubConnected = $state(false)
	let showGithubError = $state(false)
	let githubErrorReason = $state<string | null>(null)

	$effect(() => {
		const params = new URLSearchParams(window.location.search)
		if (params.get('github') === 'connected') {
			showGithubConnected = true
			window.history.replaceState({}, '', window.location.pathname)
		}
		if (params.get('github') === 'error') {
			showGithubError = true
			githubErrorReason = params.get('reason')
			window.history.replaceState({}, '', window.location.pathname)
		}
	})
</script>

<h1>Account Settings</h1>
<p><a href="/">← Back to Home</a></p>

{#if form?.error}
	<p role="alert" style="color: red;">{form.error}</p>
{/if}

{#if showGithubConnected}
	<p role="alert" style="color: green;">GitHub account connected successfully!</p>
{/if}

{#if showGithubError}
	<p role="alert" style="color: red;">
		GitHub connection failed{githubErrorReason ? `: ${githubErrorReason}` : '.'}
	</p>
{/if}

<section>
	<h2>GitHub Export</h2>
	{#if data.github.connected}
		<p>✓ Connected as <strong>{data.github.username}</strong></p>
		<p>Your GitHub account is authorized to receive exports of your Agents, Skills, and Workflows.</p>
		<form method="POST" action="?/revoke">
			<button type="submit" style="background-color: #f0f0f0; color: #333;">
				Revoke GitHub Access
			</button>
		</form>
		<p style="font-size: 0.9em; color: #666;">
			You can also revoke app access directly on <a href="https://github.com/settings/applications" target="_blank">GitHub's settings page</a>.
		</p>
	{:else}
		<p>Not connected. Connect your GitHub account to export your work directly to a repository.</p>
		<form method="POST" action="?/connect">
			<button type="submit" style="background-color: #24292e; color: white; padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer;">
				Connect GitHub
			</button>
		</form>
	{/if}
</section>

<style>
	section {
		border: 1px solid #ddd;
		padding: 16px;
		margin: 16px 0;
		border-radius: 4px;
	}

	button {
		padding: 8px 16px;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #f9f9f9;
	}
</style>
