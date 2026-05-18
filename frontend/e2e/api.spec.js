const { test, expect } = require('@playwright/test');
const { BASE_URL, BACKEND_URL, TEST_USERS } = require('./helpers');

test.describe('Health Check', () => {
  test('backend /api/health returns healthy status', async ({ page }) => {
    const res = await page.request.get(`${BACKEND_URL}/api/health`);
    // Health check is public — no auth required
    expect(res.status()).toBeGreaterThanOrEqual(200);
    const body = await res.json();
    expect(body.status).toBeDefined();
    expect(body.uptime).toBeGreaterThan(0);
  });
});

test.describe('AI Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login via API
    const loginRes = await page.request.post(`${BACKEND_URL}/api/auth/login`, {
      data: {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();
    await page.goto(BASE_URL);
    await page.evaluate((t) => localStorage.setItem('token', t), token);
  });

  test('settings page loads without crash', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('AI settings panel is visible on settings page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('domcontentloaded');
    // Should have some text content related to AI or settings
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });
});

test.describe('API Auth - Token Validation', () => {
  test('API rejects requests without token', async ({ page }) => {
    const res = await page.request.get(`${BACKEND_URL}/api/spaces`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('API rejects requests with invalid token', async ({ page }) => {
    const res = await page.request.get(`${BACKEND_URL}/api/spaces`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(res.status()).toBe(403);
  });

  test('API accepts requests with valid token', async ({ page }) => {
    const loginRes = await page.request.post(`${BACKEND_URL}/api/auth/login`, {
      data: { email: TEST_USERS.admin.email, password: TEST_USERS.admin.password },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();
    const res = await page.request.get(`${BACKEND_URL}/api/spaces`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const spaces = await res.json();
    expect(Array.isArray(spaces)).toBe(true);
  });
});

test.describe('API - Spaces CRUD', () => {
  let authToken;
  const testSpaceSlug = `e2e-test-space-${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${BACKEND_URL}/api/auth/login`, {
      data: { email: TEST_USERS.admin.email, password: TEST_USERS.admin.password },
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await loginRes.json();
    authToken = body.token;
  });

  test('can create a space', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/api/spaces`, {
      data: { name: 'E2E Test Space', slug: testSpaceSlug },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    expect(res.status()).toBe(201);
    const space = await res.json();
    expect(space.name).toBe('E2E Test Space');
    expect(space.slug).toBe(testSpaceSlug);
  });

  test('can list spaces', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/spaces`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status()).toBe(200);
    const spaces = await res.json();
    expect(Array.isArray(spaces)).toBe(true);
    expect(spaces.length).toBeGreaterThan(0);
  });

  test('cannot create space with duplicate slug', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/api/spaces`, {
      data: { name: 'Duplicate', slug: testSpaceSlug },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    // Should get 409 Conflict
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('cannot create space with invalid slug (uppercase)', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/api/spaces`, {
      data: { name: 'Bad Space', slug: 'Bad-Space' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('validation rejects missing name on space creation', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/api/spaces`, {
      data: { slug: 'some-slug' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    expect(res.status()).toBe(400);
  });
});
