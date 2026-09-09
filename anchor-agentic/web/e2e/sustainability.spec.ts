import { expect, test } from '@playwright/test';

const hasLiveSupabase =
	!!process.env.PUBLIC_SUPABASE_URL && !process.env.PUBLIC_SUPABASE_URL.includes('placeholder');

test.describe('Donation link-out (US-041)', () => {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});

	test('anonymous visitor sees a non-intrusive donation link on the Marketplace that opens externally', async ({
		page
	}) => {
		await page.goto('/');

		const donationLink = page.getByRole('link', { name: /support this project/i });
		await expect(donationLink).toBeVisible();
		await expect(donationLink).toHaveAttribute('href', 'https://github.com/sponsors/foldhpet');
		await expect(donationLink).toHaveAttribute('target', '_blank');
		await expect(donationLink).toHaveAttribute('rel', /noopener/);

		// No feature is gated behind it: Marketplace browsing and item listing still work normally.
		await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
	});

	test('donation link is present without logging in and without any account', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('link', { name: /support this project/i })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
	});
});
