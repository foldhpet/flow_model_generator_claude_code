<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>{data.item.title}</h1>
<p>Status: {data.item.status}</p>

{#if data.session}
	<!-- Rate/Clone controls land in a later epic; gated on session so
	     anonymous visitors never see actions they can't perform. -->
	<p><em>Rate and Clone actions are not yet available.</em></p>
{/if}

<p><a href="/">Back to Marketplace</a></p>
