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

test.describe('Domain authoring (US-005–US-013)', () => {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});

	test('create a Role, Agent, Task assignment, Skill, and a Workflow mixing all three step types, then reorder', async ({
		page
	}) => {
		const stamp = await registerUser(page, 'wf');

		// Role
		await page.goto('/roles');
		const roleName = `Reviewer ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();
		await page.getByRole('link', { name: roleName }).click();

		// Task, created under the Role
		const taskName = `Review PR ${stamp}`;
		const taskForm = page.locator('form[action="?/createTask"]');
		await taskForm.getByLabel('Name').fill(taskName);
		await taskForm.getByLabel('Instructions').fill('Check the diff for regressions.');
		await page.getByRole('button', { name: 'Create Task' }).click();
		await expect(page.getByRole('link', { name: taskName })).toBeVisible();

		// Agent for the Role
		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByLabel('System prompt').fill('You review pull requests.');
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);
		const agentUrl = page.url();

		// A second Agent for the same Role must be rejected (US-007 AC3).
		await page.goto('/agents/new');
		await expect(page.getByText('All of your Roles already have an Agent.')).toBeVisible();
		await page.goto(agentUrl);

		// Assign the Task to the Agent
		await page.getByRole('button', { name: 'Assign' }).click();
		await expect(page.getByRole('button', { name: 'Unassign' })).toBeVisible();

		// Skill (Role-independent)
		await page.goto('/skills/new');
		const skillName = `Lint Runner ${stamp}`;
		await page.getByLabel('Name').fill(skillName);
		await page.getByLabel('Path').fill('SKILL.md');
		await page.getByLabel('Content').fill('# Lint Runner\nRun the linter.');
		await page.getByRole('button', { name: 'Create Skill' }).click();
		await expect(page).toHaveURL(/\/skills\/[0-9a-f-]+$/);

		// Workflow mixing Task + Agent + Skill steps
		await page.goto('/workflows/new');
		const workflowName = `Release Flow ${stamp}`;
		await page.getByLabel('Name').fill(workflowName);
		await page.getByRole('button', { name: 'Create Workflow' }).click();
		await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]+$/);

		// The Add Step <form> is native-reset by use:enhance after each
		// successful submit, which can race with immediately re-selecting the
		// next step's type/reference — wait for the step count to advance
		// after each submit before touching the form again.
		const addStepForm = page.locator('form[action="?/addStep"]');
		const steps = page.locator('ol > li');

		await addStepForm.locator('select[name="step_type"]').selectOption('TASK');
		await addStepForm.locator('select[name="reference_id"]').selectOption({ label: taskName });
		await page.getByRole('button', { name: 'Add Step' }).click();
		await expect(steps).toHaveCount(1);

		await addStepForm.locator('select[name="step_type"]').selectOption('AGENT');
		await addStepForm
			.locator('select[name="reference_id"]')
			.selectOption({ label: `Agent for ${roleName}` });
		await page.getByRole('button', { name: 'Add Step' }).click();
		await expect(steps).toHaveCount(2);

		await addStepForm.locator('select[name="step_type"]').selectOption('SKILL');
		await addStepForm.locator('select[name="reference_id"]').selectOption({ label: skillName });
		await page.getByRole('button', { name: 'Add Step' }).click();
		await expect(steps).toHaveCount(3);
		await expect(steps.nth(0)).toContainText('TASK');
		await expect(steps.nth(1)).toContainText('AGENT');
		await expect(steps.nth(2)).toContainText('SKILL');

		// Reorder: move the Skill step (last) up one position.
		await steps.nth(2).getByRole('button', { name: '↑' }).click();
		await expect(steps.nth(1)).toContainText('SKILL');
		await expect(steps.nth(2)).toContainText('AGENT');

		// Remove the Agent step (now last) and confirm gapless renumbering.
		await steps.nth(2).getByRole('button', { name: 'Remove' }).click();
		await expect(steps).toHaveCount(2);
		await expect(steps.nth(0)).toContainText('TASK');
		await expect(steps.nth(1)).toContainText('SKILL');

		// Reload and confirm persistence.
		await page.reload();
		await expect(steps).toHaveCount(2);
		await expect(steps.nth(0)).toContainText('TASK');
		await expect(steps.nth(1)).toContainText('SKILL');
	});

	test("a non-owner sees a read-only Agent page rather than an edit form", async ({
		page,
		browser
	}) => {
		const stamp = await registerUser(page, 'owner');

		await page.goto('/roles');
		const roleName = `Support ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();

		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);
		const agentUrl = page.url();

		const contextB = await browser.newContext();
		const pageB = await contextB.newPage();
		await registerUser(pageB, 'viewer');

		await pageB.goto(agentUrl);
		await expect(pageB.getByRole('heading', { name: `Agent for ${roleName}` })).toBeVisible();
		await expect(pageB.getByRole('button', { name: 'Save' })).toHaveCount(0);
		await expect(pageB.getByText('Status:')).toBeVisible();

		await contextB.close();
	});
});
