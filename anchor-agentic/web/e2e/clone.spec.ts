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

async function publish(page: import('@playwright/test').Page) {
	const updateForm = page.locator('form[action="?/update"]');
	await updateForm.locator('select[name="status"]').selectOption('Published');
	await Promise.all([
		page.waitForResponse(
			(resp) => resp.url().includes('?/update') && resp.request().method() === 'POST'
		),
		updateForm.getByRole('button', { name: 'Save' }).click()
	]);
}

test.describe('Clone (US-020–US-022)', () => {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});

	test('cloning a Published Agent duplicates its Role and every assigned Task into the cloning user\'s own Library', async ({
		page,
		browser
	}) => {
		const stamp = await registerUser(page, 'clonesrc');

		await page.goto('/roles');
		const roleName = `Test Analyst ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();
		await page.getByRole('link', { name: roleName }).click();
		await page.waitForURL(/\/roles\/[0-9a-f-]+$/);

		const taskNames = [`Plan tests ${stamp}`, `Run tests ${stamp}`, `Report results ${stamp}`];
		const taskForm = page.locator('form[action="?/createTask"]');
		for (const taskName of taskNames) {
			await taskForm.getByLabel('Name').fill(taskName);
			await page.getByRole('button', { name: 'Create Task' }).click();
			await expect(page.getByRole('link', { name: taskName })).toBeVisible();
		}

		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByLabel('System prompt').fill('You are a diligent Test Analyst.');
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);

		for (const taskName of taskNames) {
			await page
				.locator('li', { hasText: taskName })
				.getByRole('button', { name: 'Assign' })
				.click();
			await expect(
				page.locator('li', { hasText: taskName }).getByRole('button', { name: 'Unassign' })
			).toBeVisible();
		}

		await publish(page);
		await expect(page.locator('select[name="status"]')).toHaveValue('Published');
		const sourceAgentUrl = page.url();

		const contextB = await browser.newContext();
		const pageB = await contextB.newPage();
		await registerUser(pageB, 'cloner');

		await pageB.goto(sourceAgentUrl);
		await expect(pageB.getByRole('button', { name: 'Save' })).toHaveCount(0);
		await Promise.all([
			pageB.waitForResponse(
				(resp) => resp.url().includes('?/clone') && resp.request().method() === 'POST'
			),
			pageB.getByRole('button', { name: 'Clone into My Sandbox' }).click()
		]);
		await pageB.waitForURL((url) => url.href !== sourceAgentUrl && /\/agents\/[0-9a-f-]+$/.test(url.pathname));

		await expect(pageB.locator('select[name="status"]')).toHaveValue('Draft');
		for (const taskName of taskNames) {
			await expect(
				pageB.locator('li', { hasText: taskName }).getByRole('button', { name: 'Unassign' })
			).toBeVisible();
		}
		await expect(pageB.getByText('Cloned from')).toBeVisible();

		await pageB.goto('/library');
		await expect(pageB.getByRole('heading', { name: 'Roles' })).toBeVisible();
		await expect(pageB.getByRole('link', { name: roleName, exact: true })).toBeVisible();
		for (const taskName of taskNames) {
			await expect(pageB.getByRole('link', { name: taskName, exact: true })).toBeVisible();
		}

		await contextB.close();

		await page.goto(sourceAgentUrl);
		await expect(page.getByText('Cloned 1 times')).toBeVisible();
	});

	test('cloning a Published Skill creates one new owned copy and shows provenance back to the source', async ({
		page,
		browser
	}) => {
		const stamp = await registerUser(page, 'skillsrc');

		await page.goto('/skills/new');
		const skillName = `Shelver ${stamp}`;
		await page.getByLabel('Name').fill(skillName);
		await page.getByLabel('Path').fill('SKILL.md');
		await page.getByLabel('Content').fill('# Shelver\nShelve things.');
		await page.getByRole('button', { name: 'Create Skill' }).click();
		await expect(page).toHaveURL(/\/skills\/[0-9a-f-]+$/);

		await publish(page);
		await expect(page.locator('select[name="status"]')).toHaveValue('Published');
		const sourceSkillUrl = page.url();

		const contextB = await browser.newContext();
		const pageB = await contextB.newPage();
		await registerUser(pageB, 'skillcloner');

		await pageB.goto(sourceSkillUrl);
		await Promise.all([
			pageB.waitForResponse(
				(resp) => resp.url().includes('?/clone') && resp.request().method() === 'POST'
			),
			pageB.getByRole('button', { name: 'Clone into My Sandbox' }).click()
		]);
		await pageB.waitForURL((url) => url.href !== sourceSkillUrl && /\/skills\/[0-9a-f-]+$/.test(url.pathname));

		await expect(pageB.locator('select[name="status"]')).toHaveValue('Draft');
		await expect(pageB.locator('input[name="name"]')).toHaveValue(skillName);
		await expect(pageB.getByText('Cloned from')).toBeVisible();

		await contextB.close();

		await page.goto(sourceSkillUrl);
		await expect(page.getByText('Cloned 1 times')).toBeVisible();
	});
});
