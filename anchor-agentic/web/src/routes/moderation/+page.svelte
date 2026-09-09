<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>Moderation Queue</h1>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.queue.length === 0}
	<p>Nothing is currently under review.</p>
{:else}
	<ul>
		{#each data.queue as item (item.item_type + item.id)}
			<li>
				<h2>[{item.item_type}] {item.name ?? item.id}</h2>
				{#if item.description}<p>{item.description}</p>{/if}
				{#if item.system_prompt}<pre>{item.system_prompt}</pre>{/if}

				{#if item.reports.length === 0}
					<p><em>Voluntary review request (US-044).</em></p>
					<form method="POST" action="?/approve" use:enhance>
						<input type="hidden" name="item_type" value={item.item_type} />
						<input type="hidden" name="id" value={item.id} />
						<button type="submit">Approve</button>
					</form>
					<form method="POST" action="?/reject" use:enhance>
						<input type="hidden" name="item_type" value={item.item_type} />
						<input type="hidden" name="id" value={item.id} />
						<label>
							Feedback:
							<textarea name="feedback"></textarea>
						</label>
						<button type="submit">Reject</button>
					</form>
				{:else}
					<h3>Reports</h3>
					<ul>
						{#each item.reports as report (report.id)}
							<li>
								[{report.reason}]{#if report.detail} {report.detail}{/if}
								<form method="POST" action="?/dismiss" use:enhance style="display:inline">
									<input type="hidden" name="report_id" value={report.id} />
									<button type="submit">Dismiss report</button>
								</form>
							</li>
						{/each}
					</ul>
					<form method="POST" action="?/remove" use:enhance>
						<input type="hidden" name="item_type" value={item.item_type} />
						<input type="hidden" name="id" value={item.id} />
						<button type="submit">Remove (terminal)</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
