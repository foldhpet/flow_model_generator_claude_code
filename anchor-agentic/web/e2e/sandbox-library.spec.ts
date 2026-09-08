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

test.describe('Sandbox & Version Control (US-014–US-019)', () => {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});

	test('My Library groups owned items by type, Publishing keeps an item visible, and Archiving hides it by default', async ({
		page
	}) => {
		const stamp = await registerUser(page, 'lib');

		// One of each entity type, mirroring domain-authoring.spec.ts's setup.
		await page.goto('/roles');
		const roleName = `Librarian ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();
		await page.getByRole('link', { name: roleName }).click();

		const taskName = `Catalog items ${stamp}`;
		const taskForm = page.locator('form[action="?/createTask"]');
		await taskForm.getByLabel('Name').fill(taskName);
		await page.getByRole('button', { name: 'Create Task' }).click();
		await expect(page.getByRole('link', { name: taskName })).toBeVisible();
		await page.getByRole('link', { name: taskName }).click();
		await page.waitForURL(/\/tasks\/[0-9a-f-]+$/);
		const taskUrl = page.url();

		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);

		await page.goto('/skills/new');
		const skillName = `Shelver ${stamp}`;
		await page.getByLabel('Name').fill(skillName);
		await page.getByLabel('Path').fill('SKILL.md');
		await page.getByLabel('Content').fill('# Shelver\nShelve things.');
		await page.getByRole('button', { name: 'Create Skill' }).click();
		await expect(page).toHaveURL(/\/skills\/[0-9a-f-]+$/);

		await page.goto('/workflows/new');
		const workflowName = `Cataloging Flow ${stamp}`;
		await page.getByLabel('Name').fill(workflowName);
		await page.getByRole('button', { name: 'Create Workflow' }).click();
		await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]+$/);

		// (1) My Library shows all five, grouped by type, with Draft badges.
		await page.goto('/library');
		await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();

		function itemRow(name: string) {
			return page.locator('li').filter({ has: page.getByRole('link', { name, exact: true }) });
		}
		const roleRow = itemRow(roleName);
		const taskRow = itemRow(taskName);
		await expect(roleRow).toContainText('[Draft]');
		await expect(taskRow).toContainText('[Draft]');
		await expect(itemRow(`Agent for ${roleName}`)).toContainText('[Draft]');
		await expect(itemRow(skillName)).toContainText('[Draft]');
		await expect(itemRow(workflowName)).toContainText('[Draft]');

		// Publish the Role — it stays visible in My Library, just with a new badge.
		await roleRow.getByRole('link', { name: roleName, exact: true }).click();
		await page.waitForURL(/\/roles\/[0-9a-f-]+$/);
		const updateForm = page.locator('form[action="?/update"]');
		await updateForm.locator('select[name="status"]').selectOption('Published');
		await Promise.all([
			page.waitForResponse(
				(resp) => resp.url().includes('?/update') && resp.request().method() === 'POST'
			),
			updateForm.getByRole('button', { name: 'Save' }).click()
		]);
		await expect(updateForm.locator('select[name="status"]')).toHaveValue('Published');

		await page.goto('/library');
		await expect(itemRow(roleName)).toContainText('[Published]');

		// (4) Archive the (still-Draft) Task — it disappears from the default view.
		await page.goto(taskUrl);
		await page.getByRole('button', { name: 'Archive' }).click();
		await expect(page.getByText('Status: Archived')).toBeVisible();
		await expect(page.getByText('This item is archived — clone it to resume work.')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);

		await page.goto('/library');
		await expect(page.locator('li', { hasText: taskName })).toHaveCount(0);
		await page.getByLabel('Show archived').check();
		await expect(page.locator('li', { hasText: taskName })).toContainText('[Archived]');
	});

	test('Version History records every save and viewing an older version does not change the current state', async ({
		page
	}) => {
		const stamp = await registerUser(page, 'ver');

		await page.goto('/roles');
		const roleName = `Historian ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await page.getByRole('link', { name: roleName }).click();
		await page.waitForURL(/\/roles\/[0-9a-f-]+$/);

		const updateForm = page.locator('form[action="?/update"]');
		const descriptionInput = updateForm.locator('input[name="description"]');

		// Save twice more (the create itself already recorded one snapshot).
		await descriptionInput.fill('First revision');
		await Promise.all([
			page.waitForResponse(
				(resp) => resp.url().includes('?/update') && resp.request().method() === 'POST'
			),
			updateForm.getByRole('button', { name: 'Save' }).click()
		]);
		await expect(descriptionInput).toHaveValue('First revision');

		await descriptionInput.fill('Second revision');
		await Promise.all([
			page.waitForResponse(
				(resp) => resp.url().includes('?/update') && resp.request().method() === 'POST'
			),
			updateForm.getByRole('button', { name: 'Save' }).click()
		]);
		await expect(descriptionInput).toHaveValue('Second revision');

		const versionButtons = page.locator('h2:has-text("Version History") ~ ul button');
		await expect(versionButtons).toHaveCount(3);

		// Viewing an older snapshot renders it read-only without touching the live form.
		await versionButtons.last().click();
		await expect(page.locator('pre')).toBeVisible();
		await expect(descriptionInput).toHaveValue('Second revision');

		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.locator('pre')).toHaveCount(0);
	});

	test('All Library is searchable across users and never renders edit controls', async ({
		page,
		browser
	}) => {
		const stamp = await registerUser(page, 'owner');

		await page.goto('/skills/new');
		const skillName = `Findable Skill ${stamp}`;
		await page.getByLabel('Name').fill(skillName);
		await page.getByLabel('Path').fill('SKILL.md');
		await page.getByLabel('Content').fill('# Findable\nBe found.');
		await page.getByRole('button', { name: 'Create Skill' }).click();
		await expect(page).toHaveURL(/\/skills\/[0-9a-f-]+$/);
		const skillUrl = page.url();

		const contextB = await browser.newContext();
		const pageB = await contextB.newPage();
		await registerUser(pageB, 'viewer');

		await pageB.goto(`/library/all?q=${encodeURIComponent(skillName)}`);
		await expect(pageB.getByRole('link', { name: skillName })).toBeVisible();
		// The results list is plain links/text — no per-item edit/delete forms.
		await expect(pageB.locator('ul form')).toHaveCount(0);
		await expect(pageB.getByRole('button', { name: 'Save' })).toHaveCount(0);
		await expect(pageB.getByRole('button', { name: 'Archive' })).toHaveCount(0);

		await pageB.goto(skillUrl);
		await expect(pageB.getByRole('button', { name: 'Save' })).toHaveCount(0);
		await expect(pageB.getByText('Status:')).toBeVisible();

		await contextB.close();
	});
});
