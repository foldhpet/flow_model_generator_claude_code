import { expect, test } from '@playwright/test';

const hasLiveSupabase =
	!!process.env.PUBLIC_SUPABASE_URL && !process.env.PUBLIC_SUPABASE_URL.includes('placeholder');

async function registerUser(page: import('@playwright/test').Page, tag: string) {
	const stamp = Date.now();
	const password = 'correct-horse-battery-staple';
	await page.goto('/register');
	await page.getByLabel('Username').fill(`${tag}${stamp}`);
	await page.getByLabel('Email').fill(`e2e-${tag}-${stamp}@mailinator.com`);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	return stamp;
}

// US-039: the proxy route (web/src/routes/export/[itemType]/[id]/+server.ts)
// is the same manifest a direct API caller gets from POST /api/v1/export
// with target: "zip" — asserting against it directly is the API-parity
// check, without relying on headless zip/download interception.
test.describe('Export & API Parity (US-033–US-035, US-037, US-039)', () => {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});

	test('owner exports a Draft Agent to .claude/agents/<slug>.md', async ({ page }) => {
		const stamp = await registerUser(page, 'expagent');

		await page.goto('/roles');
		const roleName = `Export Reviewer ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();

		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByLabel('System prompt').fill('You review release notes for accuracy.');
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);
		const agentId = page.url().split('/').pop();

		// Never published — proves export is not gated behind Published status
		// for the owner (unlike clone.ts's rule).
		await expect(page.getByText('Status: Draft')).toBeVisible();

		const res = await page.request.get(`/export/AGENT/${agentId}`);
		expect(res.ok()).toBe(true);
		const { files } = await res.json();
		expect(Array.isArray(files)).toBe(true);
		expect(files).toHaveLength(1);
		expect(files[0].path).toMatch(/^\.claude\/agents\/.+\.md$/);
		expect(files[0].content).toContain(roleName);
		expect(files[0].content).toContain('You review release notes for accuracy.');
	});

	test('owner exports a Skill to .claude/skills/<slug>/, preserving file content byte-for-byte', async ({
		page
	}) => {
		const stamp = await registerUser(page, 'expskill');

		await page.goto('/skills/new');
		const skillName = `Export Lint Runner ${stamp}`;
		const skillContent = '# Lint Runner\nRun the linter before every commit.';
		await page.getByLabel('Name').fill(skillName);
		await page.getByLabel('Path').fill('SKILL.md');
		await page.getByLabel('Content').fill(skillContent);
		await page.getByRole('button', { name: 'Create Skill' }).click();
		await expect(page).toHaveURL(/\/skills\/[0-9a-f-]+$/);
		const skillId = page.url().split('/').pop();

		const res = await page.request.get(`/export/SKILL/${skillId}`);
		expect(res.ok()).toBe(true);
		const { files } = await res.json();
		expect(files).toHaveLength(1);
		expect(files[0].path).toMatch(/^\.claude\/skills\/.+\/SKILL\.md$/);
		expect(files[0].content).toBe(skillContent);
	});

	test("owner exports a Workflow to .claude/commands/<slug>.md, inlining a Task step's instructions", async ({
		page
	}) => {
		const stamp = await registerUser(page, 'expwf');

		await page.goto('/roles');
		const roleName = `Export Flow Role ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();
		await page.getByRole('link', { name: roleName }).click();

		const taskName = `Draft Release Notes ${stamp}`;
		const taskForm = page.locator('form[action="?/createTask"]');
		await taskForm.getByLabel('Name').fill(taskName);
		await taskForm.getByLabel('Instructions').fill('Summarize every merged PR since the last tag.');
		await page.getByRole('button', { name: 'Create Task' }).click();
		await expect(page.getByRole('link', { name: taskName })).toBeVisible();

		await page.goto('/workflows/new');
		const workflowName = `Export Release Flow ${stamp}`;
		await page.getByLabel('Name').fill(workflowName);
		await page.getByRole('button', { name: 'Create Workflow' }).click();
		await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]+$/);
		const workflowId = page.url().split('/').pop();

		const addStepForm = page.locator('form[action="?/addStep"]');
		await addStepForm.locator('select[name="step_type"]').selectOption('TASK');
		await addStepForm.locator('select[name="reference_id"]').selectOption({ label: taskName });
		await page.getByRole('button', { name: 'Add Step' }).click();
		await expect(page.locator('ol > li')).toHaveCount(1);

		const res = await page.request.get(`/export/WORKFLOW/${workflowId}`);
		expect(res.ok()).toBe(true);
		const { files } = await res.json();
		expect(files).toHaveLength(1);
		expect(files[0].path).toMatch(/^\.claude\/commands\/.+\.md$/);
		expect(files[0].content).toContain(taskName);
		expect(files[0].content).toContain('Summarize every merged PR since the last tag.');
	});

	test('owner exports a Workflow with an Agent step: bundles the Agent file alongside the command file', async ({
		page
	}) => {
		const stamp = await registerUser(page, 'expwf-agent');

		// Create a Role and Agent
		await page.goto('/roles');
		const roleName = `Export Agent Role ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();

		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByLabel('System prompt').fill('Organize files into categories.');
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);
		const agentId = page.url().split('/').pop();

		// Create a Workflow with the Agent step
		await page.goto('/workflows/new');
		const workflowName = `Export Flow with Agent ${stamp}`;
		await page.getByLabel('Name').fill(workflowName);
		await page.getByRole('button', { name: 'Create Workflow' }).click();
		await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]+$/);
		const workflowId = page.url().split('/').pop();

		const addStepForm = page.locator('form[action="?/addStep"]');
		await addStepForm.locator('select[name="step_type"]').selectOption('AGENT');
		// The agent's label in the dropdown is typically "Agent for <RoleName>" or similar
		await addStepForm.locator('select[name="reference_id"]').selectOption({ label: new RegExp(roleName) });
		await page.getByRole('button', { name: 'Add Step' }).click();
		await expect(page.locator('ol > li')).toHaveCount(1);

		// Export should bundle the Agent file
		const res = await page.request.get(`/export/WORKFLOW/${workflowId}`);
		expect(res.ok()).toBe(true);
		const { files } = await res.json();

		// Should have: 1 Workflow command file + 1 Agent file
		expect(files.length).toBeGreaterThanOrEqual(2);
		const commandFile = files.find((f: { path: string }) => f.path.includes('.claude/commands/'));
		const agentFile = files.find((f: { path: string }) => f.path.includes('.claude/agents/'));

		expect(commandFile).toBeTruthy();
		expect(agentFile).toBeTruthy();
		expect(commandFile!.content).toContain('Agent for ' + roleName);
		expect(agentFile!.content).toContain('Organize files into categories.');
	});

	test("a non-owner cannot export another user's Draft item", async ({ page, browser }) => {
		await registerUser(page, 'expowner');

		await page.goto('/skills/new');
		const skillName = 'Owner-only skill';
		await page.getByLabel('Name').fill(skillName);
		await page.getByLabel('Path').fill('SKILL.md');
		await page.getByLabel('Content').fill('# Private\nNot published.');
		await page.getByRole('button', { name: 'Create Skill' }).click();
		await expect(page).toHaveURL(/\/skills\/[0-9a-f-]+$/);
		const skillId = page.url().split('/').pop();

		const contextB = await browser.newContext();
		const pageB = await contextB.newPage();
		await registerUser(pageB, 'expviewer');

		const res = await pageB.request.get(`/export/SKILL/${skillId}`);
		expect(res.status()).toBe(403);

		await contextB.close();
	});

	test('exporting a Workflow with an Archived step reference is rejected with dangling_step_reference', async ({
		page
	}) => {
		const stamp = await registerUser(page, 'expdangle');

		await page.goto('/roles');
		const roleName = `Dangling Role ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();
		await page.getByRole('link', { name: roleName }).click();

		const taskName = `Soon Archived Task ${stamp}`;
		const taskForm = page.locator('form[action="?/createTask"]');
		await taskForm.getByLabel('Name').fill(taskName);
		await page.getByRole('button', { name: 'Create Task' }).click();
		await expect(page.getByRole('link', { name: taskName })).toBeVisible();
		await page.getByRole('link', { name: taskName }).click();
		await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+$/);
		const taskUrl = page.url();

		await page.goto('/workflows/new');
		const workflowName = `Dangling Flow ${stamp}`;
		await page.getByLabel('Name').fill(workflowName);
		await page.getByRole('button', { name: 'Create Workflow' }).click();
		await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]+$/);
		const workflowId = page.url().split('/').pop();

		const addStepForm = page.locator('form[action="?/addStep"]');
		await addStepForm.locator('select[name="step_type"]').selectOption('TASK');
		await addStepForm.locator('select[name="reference_id"]').selectOption({ label: taskName });
		await page.getByRole('button', { name: 'Add Step' }).click();
		await expect(page.locator('ol > li')).toHaveCount(1);

		// Archiving does not check for existing Workflow-step references, so
		// this is how a dangling reference actually arises (US-035 AC4).
		await page.goto(taskUrl);
		await page.getByRole('button', { name: 'Archive' }).click();
		await expect(page.getByText('Status: Archived')).toBeVisible();

		const res = await page.request.get(`/export/WORKFLOW/${workflowId}`);
		expect(res.status()).toBe(400);
		const body = await res.json();
		expect(body.message).toBe('dangling_step_reference');
	});
});
