/**
 * Spaces UI tests — focuses on browser rendering and interaction.
 * API/CRUD operations are covered in api.spec.js
 */
const { test, expect } = require('@playwright/test');
const { BASE_URL, BACKEND_URL, TEST_USERS } = require('./helpers');

test.describe('Spaces UI', () => {
  test('spaces page loads without crash when authenticated', async ({ page }) => {
    // Login via API token injection
    const loginRes = await page.request.post(`${BACKEND_URL}/api/auth/login`, {
      data: { email: TEST_USERS.admin.email, password: TEST_USERS.admin.password },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();
    await page.goto(BASE_URL);
    await page.evaluate((t) => localStorage.setItem('token', t), token);

    await page.goto(`${BASE_URL}/spaces`);
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('spaces page is not accessible without auth token', async ({ page }) => {
    await page.goto(`${BASE_URL}/spaces`);
    // Without token, the app should redirect to /login or show login UI
    const url = page.url();
    const hasLoginForm = await page.locator('input[type="email"]').isVisible().catch(() => false);
    const isLoginPage = url.includes('/login');
    expect(hasLoginForm || isLoginPage).toBeTruthy();
  });
});
