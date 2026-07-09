import { expect, test } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.skip(!email || !password, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run the authenticated product flow.');

test('authenticated user can open core travel pages', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/dashboard/);

  await page.getByRole('link', { name: 'Plan trip' }).click();
  await expect(page.getByRole('heading', { name: /Create your itinerary/i })).toBeVisible();

  await page.goto('/saved-routes');
  await expect(page.getByRole('heading', { name: 'Your saved routes' })).toBeVisible();

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: /Your profile/i })).toBeVisible();
});
