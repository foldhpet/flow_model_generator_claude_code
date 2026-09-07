import { expect, test } from '@playwright/test';

const hasLiveSupabase =
	!!process.env.PUBLIC_SUPABASE_URL && !process.env.PUBLIC_SUPABASE_URL.includes('placeholder');

test.describe('Authentication (US-001, US-002)', () => {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});

	test('register, log out, then log back in', async ({ page }) => {
		const email = `e2e-${Date.now()}@mailinator.com`;
		const password = 'correct-horse-battery-staple';

		await page.goto('/register');
		await page.getByLabel('Username').fill(`e2euser${Date.now()}`);
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page).toHaveURL('/');
		await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

		await page.getByRole('button', { name: 'Log out' }).click();
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();

		await page.goto('/login');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Log in' }).click();

		await expect(page).toHaveURL('/');
		await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
	});

	test('registering with an already-used email shows an error', async ({ page }) => {
		const email = `e2e-dup-${Date.now()}@mailinator.com`;
		const password = 'correct-horse-battery-staple';

		await page.goto('/register');
		await page.getByLabel('Username').fill(`dup1${Date.now()}`);
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Create account' }).click();
		await expect(page).toHaveURL('/');
		await page.getByRole('button', { name: 'Log out' }).click();

		await page.goto('/register');
		await page.getByLabel('Username').fill(`dup2${Date.now()}`);
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page.getByText(/already exists|already registered/i)).toBeVisible();
	});

	test('logging in with a wrong password shows a vague error', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(`nonexistent-${Date.now()}@mailinator.com`);
		await page.getByLabel('Password').fill('whatever-wrong-password');
		await page.getByRole('button', { name: 'Log in' }).click();

		await expect(page.getByText('Invalid email or password.')).toBeVisible();
	});
});
