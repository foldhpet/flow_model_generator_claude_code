import { expect, test } from '@playwright/test';

const hasLiveSupabase =
	!!process.env.PUBLIC_SUPABASE_URL && !process.env.PUBLIC_SUPABASE_URL.includes('placeholder');

test.describe('Anonymous browsing (US-003)', () => {
	// The Marketplace list is server-rendered via a call to the api/ Worker,
	// which needs real Supabase credentials to answer — the Sandbox redirect
	// guard below runs in hooks.server.ts before any API call, so it doesn't.
	test('anonymous visitors can view the Marketplace without logging in', async ({ page }) => {
		test.skip(!hasLiveSupabase, 'Marketplace SSR calls the api/ Worker — see web/.env');
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
	});

	test('anonymous direct navigation to /sandbox redirects to login with a reason banner', async ({
		page
	}) => {
		await page.goto('/sandbox');
		await expect(page).toHaveURL(/\/login\?reason=sandbox/);
		await expect(page.getByRole('alert')).toContainText('Register or log in');
	});

	test('anonymous direct navigation to /sandbox/all redirects to login', async ({ page }) => {
		await page.goto('/sandbox/all');
		await expect(page).toHaveURL(/\/login\?reason=sandbox/);
	});
});

test.describe('Permission boundary enforcement (US-004)', () => {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});

	test("a registered user cannot edit another user's sandbox item", async ({ page, browser }) => {
		const stamp = Date.now();
		const password = 'correct-horse-battery-staple';
		const itemTitle = `Owned by A ${stamp}`;

		// User A registers and creates an item in their own Sandbox.
		await page.goto('/register');
		await page.getByLabel('Username').fill(`usera${stamp}`);
		await page.getByLabel('Email').fill(`e2e-a-${stamp}@mailinator.com`);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Create account' }).click();
		await expect(page).toHaveURL('/');

		await page.goto('/sandbox');
		await page.getByLabel('New item title').fill(itemTitle);
		await page.getByRole('button', { name: 'Create' }).click();
		await expect(page.locator('li input[name="title"]').first()).toHaveValue(itemTitle);

		// User B registers in a separate browser context and views All Sandbox.
		const contextB = await browser.newContext();
		const pageB = await contextB.newPage();
		await pageB.goto('/register');
		await pageB.getByLabel('Username').fill(`userb${stamp}`);
		await pageB.getByLabel('Email').fill(`e2e-b-${stamp}@mailinator.com`);
		await pageB.getByLabel('Password').fill(password);
		await pageB.getByRole('button', { name: 'Create account' }).click();
		await expect(pageB).toHaveURL('/');

		await pageB.goto('/sandbox/all');
		const itemRow = pageB.getByText(itemTitle, { exact: false });
		await expect(itemRow).toBeVisible();

		// The "try editing" control only renders for items B does not own — and
		// attempting the write is rejected with a 403 mapped to a visible error.
		await pageB.getByRole('button', { name: 'Try editing (expect forbidden)' }).click();
		await expect(pageB.getByRole('alert')).toContainText('Forbidden');

		await contextB.close();
	});
});
