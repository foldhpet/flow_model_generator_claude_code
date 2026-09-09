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
	await Promise.all([
		page.waitForResponse(
			(resp) => resp.url().includes('?/publish') && resp.request().method() === 'POST'
		),
		page.getByRole('button', { name: 'Publish' }).click()
	]);
}

test.describe('Marketplace Browse & Search (US-026–US-028)', () => {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});

	test('anonymous visitor browses the listing and opens a detail page with no Clone/Rate/edit controls', async ({
		page,
		browser
	}) => {
		const stamp = await registerUser(page, 'mktagent');

		await page.goto('/roles');
		const roleName = `Test Analyst ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();

		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByLabel('System prompt').fill('You are a diligent Test Analyst.');
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);

		await publish(page);
		await expect(page.getByText(/Published at v\d+\./)).toBeVisible();
		const agentId = page.url().split('/').pop();

		const contextAnon = await browser.newContext();
		const anon = await contextAnon.newPage();

		await anon.goto('/');
		await expect(anon.getByRole('link', { name: `Agent for ${roleName}`, exact: true })).toBeVisible();
		await anon.getByRole('link', { name: `Agent for ${roleName}`, exact: true }).click();
		await anon.waitForURL(`/marketplace/AGENT/${agentId}`);

		await expect(anon.getByText('Not yet rated')).toBeVisible();
		await expect(anon.getByRole('button', { name: 'Clone into My Sandbox' })).toHaveCount(0);
		await expect(anon.getByRole('button', { name: 'Save' })).toHaveCount(0);

		await contextAnon.close();
	});

	test('a registered user can rate a Published item; resubmitting updates the rating instead of duplicating it; anonymous visitors see the live aggregate with no rating control', async ({
		page,
		browser
	}) => {
		const stamp = await registerUser(page, 'mktrater');

		await page.goto('/roles');
		const roleName = `Rated Role ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();

		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByLabel('System prompt').fill('You are a diligent rated Agent.');
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);
		await publish(page);
		await expect(page.getByText(/Published at v\d+\./)).toBeVisible();
		const agentId = page.url().split('/').pop();

		await page.goto(`/marketplace/AGENT/${agentId}`);
		await expect(page.getByText('Not yet rated')).toBeVisible();

		await page.locator('form[action="?/rate"] select[name="score"]').selectOption('4');
		await Promise.all([
			page.waitForResponse((resp) => resp.url().includes('?/rate') && resp.request().method() === 'POST'),
			page.getByRole('button', { name: 'Rate' }).click()
		]);
		await expect(page.getByText('Rating: 4.0/5 (1 rating)')).toBeVisible();

		// Resubmitting updates the rater's own row in place (upsert) — still
		// 1 rating counted, not 2 (US-030 AC1/AC2).
		await page.locator('form[action="?/rate"] select[name="score"]').selectOption('2');
		await Promise.all([
			page.waitForResponse((resp) => resp.url().includes('?/rate') && resp.request().method() === 'POST'),
			page.getByRole('button', { name: 'Rate' }).click()
		]);
		await expect(page.getByText('Rating: 2.0/5 (1 rating)')).toBeVisible();

		// A second, anonymous visitor immediately sees the same aggregate and
		// gets no rating control at all (US-031 AC1/AC2, US-032 AC2/AC3).
		const contextAnon = await browser.newContext();
		const anon = await contextAnon.newPage();
		await anon.goto(`/marketplace/AGENT/${agentId}`);
		await expect(anon.getByText('Rating: 2.0/5 (1 rating)')).toBeVisible();
		await expect(anon.locator('form[action="?/rate"]')).toHaveCount(0);
		await contextAnon.close();
	});

	test('published items are searchable by name, type, and role, and a registered user can Clone from the detail page', async ({
		page,
		browser
	}) => {
		const stamp = await registerUser(page, 'mktsrc');

		await page.goto('/roles');
		const roleName = `Librarian ${stamp}`;
		await page.locator('form[action="?/create"]').getByLabel('Name').fill(roleName);
		await page.getByRole('button', { name: 'Create Role' }).click();
		await expect(page.getByRole('link', { name: roleName })).toBeVisible();

		await page.goto('/agents/new');
		await page.getByLabel('Role').selectOption({ label: roleName });
		await page.getByLabel('System prompt').fill('You are a diligent Librarian.');
		await page.getByRole('button', { name: 'Create Agent' }).click();
		await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+$/);
		await publish(page);
		await expect(page.getByText(/Published at v\d+\./)).toBeVisible();
		const agentUrl = page.url();

		await page.goto('/workflows/new');
		const workflowName = `Cataloging Flow ${stamp}`;
		await page.getByLabel('Name').fill(workflowName);
		await page.getByRole('button', { name: 'Create Workflow' }).click();
		await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]+$/);

		await page.locator('select[name="step_type"]').selectOption('AGENT');
		await page.getByRole('button', { name: 'Add Step' }).click();
		await expect(page.getByText(`AGENT: Agent for ${roleName}`)).toBeVisible();

		await publish(page);
		await expect(page.getByText(/Published at v\d+\./)).toBeVisible();

		// Search by name finds the Agent.
		await page.goto(`/?q=${encodeURIComponent(roleName)}`);
		await expect(page.getByRole('link', { name: `Agent for ${roleName}`, exact: true })).toBeVisible();

		// Type filter narrows to Workflows only.
		await page.goto('/?type=WORKFLOW');
		await expect(page.getByRole('link', { name: workflowName, exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: `Agent for ${roleName}`, exact: true })).toHaveCount(0);

		// Role filter finds the Agent fulfilling that Role.
		await page.goto(`/?role=${encodeURIComponent(roleName)}`);
		await expect(page.getByRole('link', { name: `Agent for ${roleName}`, exact: true })).toBeVisible();

		// A second registered user clones the Agent from its Marketplace detail page.
		const contextB = await browser.newContext();
		const pageB = await contextB.newPage();
		await registerUser(pageB, 'mktcloner');

		const agentId = agentUrl.split('/').pop();
		await pageB.goto(`/marketplace/AGENT/${agentId}`);
		await expect(pageB.getByRole('button', { name: 'Clone into My Sandbox' })).toBeVisible();
		await Promise.all([
			pageB.waitForResponse(
				(resp) => resp.url().includes('?/clone') && resp.request().method() === 'POST'
			),
			pageB.getByRole('button', { name: 'Clone into My Sandbox' }).click()
		]);
		await pageB.waitForURL(/\/agents\/[0-9a-f-]+$/);
		await expect(pageB.getByText('Status: Draft')).toBeVisible();
		await expect(pageB.getByText('Cloned from')).toBeVisible();

		await contextB.close();
	});

	test('a Draft item\'s Marketplace detail URL 404s for both anonymous and non-owner registered visitors', async ({
		page,
		browser
	}) => {
		await registerUser(page, 'mktdraft');

		await page.goto('/skills/new');
		await page.getByLabel('Name').fill('Never Published');
		await page.getByLabel('Path').fill('SKILL.md');
		await page.getByLabel('Content').fill('# Draft\nStays a draft.');
		await page.getByRole('button', { name: 'Create Skill' }).click();
		await expect(page).toHaveURL(/\/skills\/[0-9a-f-]+$/);
		const draftId = page.url().split('/').pop();

		const contextAnon = await browser.newContext();
		const anon = await contextAnon.newPage();
		const anonResponse = await anon.goto(`/marketplace/SKILL/${draftId}`);
		expect(anonResponse?.status()).toBe(404);
		await contextAnon.close();

		const contextB = await browser.newContext();
		const pageB = await contextB.newPage();
		await registerUser(pageB, 'mktdraftviewer');
		const viewerResponse = await pageB.goto(`/marketplace/SKILL/${draftId}`);
		expect(viewerResponse?.status()).toBe(404);
		await contextB.close();
	});
});
