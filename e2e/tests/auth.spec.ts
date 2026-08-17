import { expect, test } from '@playwright/test';

/**
 * Authentication E2E (runs against the docker compose stack).
 * Validates the login-related acceptance criteria.
 */

test('the login screen shows only "Sign in with Google"', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: /Sign in with Google/i })).toBeVisible();

  // There must be no username/password fields on the main screen.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByText(/break-glass|local admin/i)).toHaveCount(0);
});

test('the undisclosed /auth/local route exposes break-glass access', async ({ page }) => {
  await page.goto('/auth/local');
  await expect(page.getByText(/Administrative access/i)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('the health API responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('ok');
});

test('protected routes require authentication', async ({ request }) => {
  const res = await request.get('/api/projects');
  expect(res.status()).toBe(401);
});
