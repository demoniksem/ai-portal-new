const { test, expect } = require('@playwright/test');
const { loginViaUI, setAuthToken, logout, hasErrorText, BASE_URL, TEST_USERS } = require('./helpers');

test.describe('Auth Flow', () => {
  test('login page renders without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveValue(TEST_USERS.admin.email);
  });

  test('successful login with correct credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_USERS.admin.email);
    await page.fill('input[type="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('failed login with wrong password shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_USERS.admin.email);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Error message div appears with inline style color #dc2626
    const errorVisible = await page.locator('div[style*="color: #dc2626"]').isVisible().catch(() => false);
    expect(errorVisible).toBeTruthy();
  });

  test('logout clears token', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_USERS.admin.email);
    await page.fill('input[type="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
    await logout(page);
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
