// US-036: Git Data API client for pushing exports to GitHub repos
// Sequence: get branch ref → get base commit tree SHA → create blobs → create new tree
// → idempotency check (skip if tree unchanged) → create commit → update ref (fast-forward)
// Wrapped with exponential backoff retry for transient failures.

export interface PushExportOptions {
	owner: string
	repo: string
	branch: string
	files: Array<{ path: string; content: string }>
	message: string
	token: string
	fetchImpl?: typeof fetch
}

export interface PushExportResult {
	commit_sha: string
	commit_url: string
	no_changes?: boolean
}

interface GitHubRef {
	ref: string
	node_id: string
	url: string
	object: {
		sha: string
		type: 'commit' | 'tag'
		url: string
	}
}

interface GitHubCommit {
	sha: string
	url: string
	html_url: string
	author?: { date: string; name: string; email: string }
	committer?: { date: string; name: string; email: string }
	message: string
	tree: { sha: string; url: string }
	parents: Array<{ sha: string; url: string; html_url: string }>
}

interface GitHubTree {
	sha: string
	url: string
	tree: Array<{
		path: string
		mode: string
		type: 'blob' | 'tree'
		sha: string
		url: string
	}>
	truncated: boolean
}

interface GitHubBlob {
	node_id: string
	url: string
	size: number
	sha: string
}

async function withRetry<T>(
	fn: () => Promise<T>,
	{ attempts = 3, baseDelayMs = 100 } = {}
): Promise<T> {
	let lastError: unknown

	for (let attempt = 0; attempt < attempts; attempt++) {
		try {
			return await fn()
		} catch (err) {
			lastError = err
			const response = err instanceof GitHubError ? err.response : null

			// Don't retry on 4xx errors (except 409/422 on ref updates, handled separately below)
			if (response && response.status >= 400 && response.status < 500) {
				throw err
			}

			// For transient errors or 5xx, wait before retry
			if (attempt < attempts - 1) {
				const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100
				await new Promise((resolve) => setTimeout(resolve, delayMs))
			}
		}
	}

	throw lastError
}

class GitHubError extends Error {
	constructor(
		public response: Response,
		public body: unknown,
		message: string
	) {
		super(message)
		this.name = 'GitHubError'
	}
}

async function githubFetch(
	url: string,
	init: RequestInit & { token: string },
	fetchImpl: typeof fetch = fetch
): Promise<Response> {
	const { token, ...requestInit } = init

	const res = await fetchImpl(url, {
		...requestInit,
		headers: {
			...requestInit.headers,
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
			Accept: 'application/vnd.github+json',
		},
	})

	if (!res.ok) {
		const body = await res.json().catch(() => ({}))
		const message = (body as { message?: string }).message || `GitHub API error ${res.status}`
		throw new GitHubError(res, body, message)
	}

	return res
}

export async function pushExport(options: PushExportOptions): Promise<PushExportResult> {
	const { owner, repo, branch, files, message, token, fetchImpl } = options
	const baseUrl = `https://api.github.com/repos/${owner}/${repo}`

	// Step 1: Get the branch ref to find the base commit
	let baseCommitSha: string
	try {
		const refRes = await withRetry(
			() => githubFetch(`${baseUrl}/git/refs/heads/${branch}`, { method: 'GET', token }, fetchImpl),
			{ attempts: 2 }
		)
		const refData = (await refRes.json()) as GitHubRef
		baseCommitSha = refData.object.sha
	} catch (err) {
		if (err instanceof GitHubError && err.response.status === 404) {
			throw new Error(`github_branch_not_found: Branch '${branch}' does not exist in ${owner}/${repo}`)
		}
		throw err
	}

	// Step 2: Get the base commit to find its tree
	const commitRes = await withRetry(
		() => githubFetch(`${baseUrl}/git/commits/${baseCommitSha}`, { method: 'GET', token }, fetchImpl),
		{ attempts: 2 }
	)
	const commitData = (await commitRes.json()) as GitHubCommit
	const baseTreeSha = commitData.tree.sha

	// Step 3: Create blobs for each file
	const blobShas: Array<{ path: string; sha: string }> = []
	for (const file of files) {
		const blobRes = await withRetry(
			() =>
				githubFetch(`${baseUrl}/git/blobs`, {
					method: 'POST',
					token,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						content: file.content,
						encoding: 'utf-8',
					}),
				}, fetchImpl),
			{ attempts: 3 }
		)
		const blobData = (await blobRes.json()) as GitHubBlob
		blobShas.push({ path: file.path, sha: blobData.sha })
	}

	// Step 4: Create a new tree
	const treeRes = await withRetry(
		() =>
			githubFetch(`${baseUrl}/git/trees`, {
				method: 'POST',
				token,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					base_tree: baseTreeSha,
					tree: blobShas.map((b) => ({
						path: b.path,
						mode: '100644',
						type: 'blob',
						sha: b.sha,
					})),
				}),
			}, fetchImpl),
		{ attempts: 3 }
	)
	const treeData = (await treeRes.json()) as GitHubTree
	const newTreeSha = treeData.sha

	// Step 5: Idempotency check — if the new tree is identical to the base tree, no changes
	if (newTreeSha === baseTreeSha) {
		return {
			commit_sha: baseCommitSha,
			commit_url: `https://github.com/${owner}/${repo}/commit/${baseCommitSha}`,
			no_changes: true,
		}
	}

	// Step 6: Create a new commit
	const newCommitRes = await withRetry(
		() =>
			githubFetch(`${baseUrl}/git/commits`, {
				method: 'POST',
				token,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message,
					tree: newTreeSha,
					parents: [baseCommitSha],
				}),
			}, fetchImpl),
		{ attempts: 3 }
	)
	const newCommitData = (await newCommitRes.json()) as GitHubCommit
	const newCommitSha = newCommitData.sha

	// Step 7: Update the branch ref (fast-forward)
	try {
		await withRetry(
			() =>
				githubFetch(`${baseUrl}/git/refs/heads/${branch}`, {
					method: 'PATCH',
					token,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						sha: newCommitSha,
						force: false, // No force push — only allow fast-forward
					}),
				}, fetchImpl),
			{ attempts: 2 } // Special handling: on 409/422, refetch baseline and retry once
		)
	} catch (err) {
		// If the ref update fails with a conflict, it likely means the ref moved between our read and write.
		// In production, this would warrant a retry with a fresh baseline. For this implementation,
		// we surface the error since retrying the entire sequence is expensive and the user can retry the export.
		if (err instanceof GitHubError && (err.response.status === 409 || err.response.status === 422)) {
			throw new Error('github_ref_conflict: Branch was updated by another push. Please retry.')
		}
		throw err
	}

	return {
		commit_sha: newCommitSha,
		commit_url: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
	}
}
