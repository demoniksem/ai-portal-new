import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for AI Portal
 * 
 * Usage:
 *   npx playwright test              — run all tests
 *   npx playwright test auth.spec.ts  — run auth tests only
 *   npx playwright test --ui          — launch UI mode
 *   npx playwright test --headed      — run in headed mode
 * 
 * Environment variables (set in .env.test):
 *   E2E_BASE_URL       — frontend URL (default: http://localhost:3000)
 *   E2E_BACKEND_URL   — backend API URL (default: http://localhost:3001)
 *   E2E_ADMIN_EMAIL   — admin login email (default: admin@portal.com)
 *   E2E_ADMIN_PASSWORD — admin password (default: admin123)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI ? undefined : undefined,
});
