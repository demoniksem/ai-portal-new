// @ts-check
/** @type {import('@playwright/test').Page} */
const { Page } = require('@playwright/test');

const TEST_USERS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@portal.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
  },
};

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:3001';

/**
 * Perform a full login via the UI (navigates to /login, fills form, submits).
 * Returns the auth token stored in localStorage.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function loginViaUI(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_USERS.admin.email);
  await page.fill('input[type="password"]', TEST_USERS.admin.password);
  await page.click('button[type="submit"]');
  // Wait for redirect to homepage
  await page.waitForURL(BASE_URL + '/', { timeout: 10000 }).catch(() => {});
  return page.evaluate(() => localStorage.getItem('token') || '');
}

/**
 * Set auth token directly in localStorage (bypasses UI login).
 * Use this when you need to be logged in but don't want to exercise the login form.
 * @param {import('@playwright/test').Page} page
 * @param {string} token
 */
async function setAuthToken(page, token) {
  await page.goto(BASE_URL);
  await page.evaluate((t) => localStorage.setItem('token', t), token);
}

/**
 * Clear auth token and reload — results in logged-out state.
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
  await page.evaluate(() => localStorage.removeItem('token'));
  await page.reload();
}

/**
 * Check if the page shows an error toast/alert with the given text (partial match).
 * @param {import('@playwright/test').Page} page
 * @param {string} fragment
 * @returns {Promise<boolean>}
 */
async function hasErrorText(page, fragment) {
  return page.evaluate(
    ([txt]) =>
      Array.from(document.querySelectorAll('[style*="color: #dc2626"], .error, [role="alert"]'))
        .some((el) => el.textContent?.includes(txt)),
    [fragment]
  );
}

module.exports = { TEST_USERS, BASE_URL, BACKEND_URL, loginViaUI, setAuthToken, logout, hasErrorText };
