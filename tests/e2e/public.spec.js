import { expect, test } from '@playwright/test';

test('homepage and public navigation are product-focused', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Personalized Tourist Guide AI/);
  await expect(page.getByRole('heading', { name: /Plan trips around the map/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Features' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create account' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Status' })).toHaveCount(0);
});

test('removed legacy public routes return the not found page', async ({ page }) => {
  const response = await page.goto('/features');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /This page does not exist/i })).toBeVisible();
});

test('auth pages hide unavailable Google sign-in by default', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('seeded', { exact: false })).toHaveCount(0);
  await expect(page.getByText('demo', { exact: false })).toHaveCount(0);

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  await expect(page.getByText('demo', { exact: false })).toHaveCount(0);
});
