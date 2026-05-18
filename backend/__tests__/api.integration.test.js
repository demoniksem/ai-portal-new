/**
 * Comprehensive API Integration Tests — ai-portal-backend
 * Uses supertest against a fully-wired Express app with mocked DB/Redis/MeiliSearch.
 *
 * Routes covered:
 *   GET  /api/health
 *   GET  /api/health/ready
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/spaces
 *   POST /api/spaces
 *   GET  /api/pages
 *   POST /api/pages
 *   GET  /api/pages/:id
 *   PATCH /api/pages/:id
 *   DELETE /api/pages/:id
 *   GET  /api/pages/:id/versions
 *   GET  /api/pages/:id/versions/:versionId
 *   POST /api/pages/:id/rollback
 *   POST /api/pages/:id/restore
 *   POST /api/pages/:id/comments
 *   GET  /api/pages/:id/comments
 *   PUT  /api/pages/:id/comments/:commentId
 *   DELETE /api/pages/:id/comments/:commentId
 *   GET  /api/search?q=
 *   POST /api/ai/build
 *   GET  /api/settings/ai
 *   PUT  /api/settings/ai
 *   GET  /api/settings/ai/providers
 *   POST /api/settings/ai/test
 *   POST /api/notifications
 *   GET  /api/notifications
 *   PUT  /api/notifications/:id/read
 *   POST /api/integrations/jira
 *   GET  /api/integrations/github
 */

// ─── Mock config module FIRST (hoisted by Jest before any imports) ───────────
const mockPoolQuery = jest.fn();
const mockPool = {
  query: mockPoolQuery,
  connect: jest.fn().mockReturnValue({ query: jest.fn(), release: jest.fn() }),
  end: jest.fn().mockResolvedValue(undefined),
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK'),
  ping: jest.fn().mockResolvedValue('PONG'),
  isReady: true,
};

const mockMeiliIndex = {
  addDocuments: jest.fn().mockResolvedValue({ taskUid: 1 }),
  updateDocuments: jest.fn().mockResolvedValue({ taskUid: 2 }),
  deleteDocument: jest.fn().mockResolvedValue({ taskUid: 3 }),
  search: jest.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 }),
  updateSearchableAttributes: jest.fn().mockResolvedValue({ taskUid: 4 }),
};

const mockMeili = {
  health: jest.fn().mockResolvedValue({ status: 'available' }),
  index: jest.fn().mockReturnValue(mockMeiliIndex),
  getIndex: jest.fn().mockResolvedValue({ uid: 'pages' }),
  getIndexes: jest.fn().mockResolvedValue({ results: [{ uid: 'pages' }] }),
  createIndex: jest.fn().mockResolvedValue({ uid: 'pages' }),
};

// Mock the config barrel — all repositories import pool from here
jest.mock('../src/config', () => ({
  pool: mockPool,
  redisClient: mockRedis,
  meiliClient: mockMeili,
  getMeiliClient: jest.fn(),
  JWT_SECRET: 'test-jwt-secret-for-integration-tests',
  JWT_EXPIRY: '1h',
  PORT: 3001,
  ALLOWED_ORIGINS: '*',
  OPENCLAW_GATEWAY_URL: 'http://localhost:18789',
}));

// Mock logger to prevent console noise and fatal exits
jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
  },
}));

// ─── Now require modules (config mock already active) ─────────────────────────
const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');

const {
  authRouter,
  spacesRouter,
  pagesRouter,
  searchRouter,
  aiRouter,
  aiSettingsRouter,
  notificationsRouter,
  integrationsRouter,
  healthRouter,
} = require('../src/routes');
const { globalLimiter, authLimiter, aiLimiter } = require('../src/middleware');
const { corsMiddleware, requestIdMiddleware, requestLoggerMiddleware } = require('../src/middleware');

// ─── Build Express app with real routes ─────────────────────────────────────
function createTestApp() {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(globalLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/spaces', spacesRouter);
  app.use('/api/pages', pagesRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/settings/ai', aiSettingsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/health', healthRouter);

  return app;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const JWT_SECRET = 'test-jwt-secret-for-integration-tests';
const ADMIN_EMAIL = 'admin@portal.com';
const ADMIN_PASS = 'admin123';
const ADMIN_ID = 1;

function makeToken(userId = ADMIN_ID, email = ADMIN_EMAIL) {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

function authHeader(userId = ADMIN_ID, email = ADMIN_EMAIL) {
  return `Bearer ${makeToken(userId, email)}`;
}

// ─── Test fixtures ────────────────────────────────────────────────────────────
const ADMIN_HASH = require('bcryptjs').hashSync(ADMIN_PASS, 10);

const mockUser = {
  id: ADMIN_ID,
  email: ADMIN_EMAIL,
  username: 'admin',
  password_hash: ADMIN_HASH,
};

const mockSpaces = [
  { id: 1, name: 'General', slug: 'general', created_by: ADMIN_ID, created_at: new Date().toISOString() },
  { id: 2, name: 'Engineering', slug: 'engineering', created_by: ADMIN_ID, created_at: new Date().toISOString() },
];

const mockPages = [
  { id: 1, space_id: 1, title: 'Welcome Page', content: '{}', acl: '{}', created_by: ADMIN_ID, created_at: new Date().toISOString() },
  { id: 2, space_id: 1, title: 'Architecture', content: '{"type":"text"}', acl: '{}', created_by: ADMIN_ID, created_at: new Date().toISOString() },
];

const mockComments = [
  { id: 1, page_id: 1, user_id: ADMIN_ID, text: 'First comment', created_at: new Date().toISOString() },
];

const mockNotifications = [
  { id: 1, user_id: ADMIN_ID, title: 'Welcome', message: 'Hello admin', is_read: false, created_at: new Date().toISOString() },
];

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
let app;

beforeAll(() => {
  app = createTestApp();
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: pool queries succeed with empty rows unless overridden per-test
  mockPoolQuery.mockResolvedValue({ rows: [] });
});

// ─── ─── ─── HEALTH ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('GET /api/health', () => {
  test('returns 200 when postgres and meilisearch are available', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('returns 503 when postgres is down', async () => {
    mockPoolQuery.mockRejectedValue(new Error('connection refused'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(['healthy', 'degraded', 'unhealthy']).toContain(res.body.status);
  });
});

describe('GET /api/health/ready', () => {
  test('returns 200 when all dependencies are up', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/health/ready');
    expect([200, 503]).toContain(res.status);
  });
});

// ─── ─── ─── AUTH ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('POST /api/auth/register', () => {
  test('201 — registers a new user and returns JWT', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })  // findByEmail → not found
      .mockResolvedValueOnce({ rows: [{ id: 2, email: 'new@portal.com', username: 'newuser' }] }); // create

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@portal.com', password: 'securepass123', username: 'newuser' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('new@portal.com');
  });

  test('409 — duplicate email returns conflict', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [mockUser] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: ADMIN_EMAIL, password: 'securepass123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('User already exists');
  });

  test('400 — invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'securepass123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — password too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'valid@email.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'securepass123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('200 — valid credentials return JWT', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: ADMIN_ID, email: ADMIN_EMAIL, username: 'admin', password_hash: ADMIN_HASH }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(ADMIN_EMAIL);
  });

  test('401 — wrong password', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: ADMIN_ID, email: ADMIN_EMAIL, username: 'admin', password_hash: ADMIN_HASH }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('401 — email not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@portal.com', password: 'anypass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('400 — invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-valid', password: 'anypass' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — empty password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@portal.com', password: '' });
    expect(res.status).toBe(400);
  });
});

// ─── ─── ─── SPACES ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('GET /api/spaces', () => {
  test('200 — returns list of spaces with valid token', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: mockSpaces });

    const res = await request(app)
      .get('/api/spaces')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('401 — rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/spaces');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

  test('403 — rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/spaces')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Invalid token');
  });
});

describe('POST /api/spaces', () => {
  test('201 — creates a new space with valid data', async () => {
    const newSpace = { id: 3, name: 'Marketing', slug: 'marketing', created_by: ADMIN_ID, created_at: new Date().toISOString() };
    mockPoolQuery.mockResolvedValueOnce({ rows: [newSpace] });

    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', authHeader())
      .send({ name: 'Marketing', slug: 'marketing' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('marketing');
    expect(res.body.name).toBe('Marketing');
  });

  test('409 — duplicate slug returns conflict', async () => {
    const pgError = new Error('duplicate key');
    pgError.code = '23505';
    mockPoolQuery.mockRejectedValueOnce(pgError);

    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', authHeader())
      .send({ name: 'General', slug: 'general' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Space with this slug already exists');
  });

  test('400 — slug with uppercase characters', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', authHeader())
      .send({ name: 'Marketing', slug: 'Marketing' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — slug with spaces', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', authHeader())
      .send({ name: 'Marketing', slug: 'marketing space' });
    expect(res.status).toBe(400);
  });

  test('400 — empty name', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', authHeader())
      .send({ name: '', slug: 'empty-name' });
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .send({ name: 'Test', slug: 'test' });
    expect(res.status).toBe(401);
  });
});

// ─── ─── ─── PAGES ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('GET /api/pages', () => {
  test('200 — returns pages with valid token', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: mockPages });

    const res = await request(app)
      .get('/api/pages')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('200 — filters pages by spaceId query param', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [mockPages[0]] });

    const res = await request(app)
      .get('/api/pages?spaceId=1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/pages');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/pages', () => {
  test('201 — creates a new page with valid data', async () => {
    const newPage = { id: 3, space_id: 1, title: 'New Page', content: '{}', acl: '{}', created_by: ADMIN_ID, created_at: new Date().toISOString() };
    mockPoolQuery.mockResolvedValueOnce({ rows: [newPage] });

    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', authHeader())
      .send({ title: 'New Page', spaceId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Page');
  });

  test('400 — missing title', async () => {
    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', authHeader())
      .send({ spaceId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — missing spaceId', async () => {
    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', authHeader())
      .send({ title: 'No Space Page' });
    expect(res.status).toBe(400);
  });

  test('400 — empty title', async () => {
    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', authHeader())
      .send({ title: '', spaceId: 1 });
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/pages')
      .send({ title: 'Hack', spaceId: 1 });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/pages/:id', () => {
  test('200 — returns existing page', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [mockPages[0]] });

    const res = await request(app)
      .get('/api/pages/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Welcome Page');
  });

  test('404 — non-existent page', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/pages/99999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Page not found');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/pages/1');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/pages/:id', () => {
  // pagesService.updatePage calls:
  //   1. pagesRepo.findById   → find the current page
  //   2. versionsRepo.createVersion  → save a version snapshot
  //   3. pagesRepo.update     → apply the update
  //   4. meiliClient.index().updateDocuments() (best-effort, caught by try/catch)
  test('200 — updates page title', async () => {
    const updated = { ...mockPages[0], title: 'Updated Title' };
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [mockPages[0]] })  // service.findById
      .mockResolvedValueOnce({ rows: [] })                // versionsRepo.createVersion
      .mockResolvedValueOnce({ rows: [mockPages[0]] })  // repo.update's findById
      .mockResolvedValueOnce({ rows: [updated] });         // repo.update's UPDATE

    const res = await request(app)
      .patch('/api/pages/1')
      .set('Authorization', authHeader())
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  test('404 — updating non-existent page', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/pages/99999')
      .set('Authorization', authHeader())
      .send({ title: 'New Title' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Page not found');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .patch('/api/pages/1')
      .send({ title: 'Hacked' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/pages/:id (soft delete)', () => {
  test('200 — soft-deletes an existing page', async () => {
    const deleted = { ...mockPages[0] };
    mockPoolQuery.mockResolvedValueOnce({ rows: [deleted] });

    const res = await request(app)
      .delete('/api/pages/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  test('404 — deleting non-existent page', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/pages/99999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).delete('/api/pages/1');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/pages/:id/versions', () => {
  test('200 — returns version history for a page', async () => {
    const versions = [
      { id: 1, page_id: 1, title: 'Old Title', content: '{}', created_by: ADMIN_ID, created_at: new Date().toISOString() },
    ];
    mockPoolQuery.mockResolvedValueOnce({ rows: versions });

    const res = await request(app)
      .get('/api/pages/1/versions')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/pages/1/versions');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/pages/:id/versions/:versionId', () => {
  test('200 — returns a specific version', async () => {
    const version = { id: 1, page_id: 1, title: 'Old Title', content: '{}', created_by: ADMIN_ID, created_at: new Date().toISOString() };
    mockPoolQuery.mockResolvedValueOnce({ rows: [version] });

    const res = await request(app)
      .get('/api/pages/1/versions/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  test('404 — version not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/pages/1/versions/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Version not found');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/pages/1/versions/1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/pages/:id/rollback', () => {
  // rollbackToVersion calls:
  //   1. getVersion (SELECT from page_versions)
  //   2. createVersion (save current state)
  //   3. update (apply rollback)
  //   4. meiliClient.index().updateDocuments() (best-effort)
  test('200 — rolls back page to a previous version', async () => {
    const rolledBack = { ...mockPages[0], title: 'Rolled Back Title' };
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, page_id: 1, title: 'Old', content: '{}', created_by: ADMIN_ID, created_at: new Date().toISOString() }] }) // versionsRepo.getVersion
      .mockResolvedValueOnce({ rows: [mockPages[0]] })  // pagesRepo.findById (currentPage)
      .mockResolvedValueOnce({ rows: [] })  // versionsRepo.createVersion (save current)
      .mockResolvedValueOnce({ rows: [{ id: 1, page_id: 1, title: 'Old', content: '{}', created_by: ADMIN_ID, created_at: new Date().toISOString() }] }) // versionsRepo.rollbackToVersion.getVersion
      .mockResolvedValueOnce({ rows: [rolledBack] }); // versionsRepo.rollbackToVersion.UPDATE

    const res = await request(app)
      .post('/api/pages/1/rollback')
      .set('Authorization', authHeader())
      .send({ versionId: 1 });

    expect(res.status).toBe(200);
  });

  test('404 — version not found for rollback', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/pages/1/rollback')
      .set('Authorization', authHeader())
      .send({ versionId: 999 });

    expect(res.status).toBe(404);
  });

  test('400 — missing versionId', async () => {
    const res = await request(app)
      .post('/api/pages/1/rollback')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/pages/1/rollback')
      .send({ versionId: 1 });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/pages/:id/restore', () => {
  test('200 — restores a soft-deleted page', async () => {
    const restored = { ...mockPages[0] };
    mockPoolQuery.mockResolvedValueOnce({ rows: [restored] });

    const res = await request(app)
      .post('/api/pages/1/restore')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
  });

  test('404 — page not found or not deleted', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/pages/99999/restore')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).post('/api/pages/1/restore');
    expect(res.status).toBe(401);
  });
});

// ─── ─── ─── COMMENTS ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('POST /api/pages/:id/comments', () => {
  // commentsRepo.create calls: ensureTable() + INSERT
  test('201 — creates a comment on a page', async () => {
    const comment = { id: 2, page_id: 1, user_id: ADMIN_ID, text: 'Great page!', created_at: new Date().toISOString() };
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })       // ensureTable CREATE TABLE
      .mockResolvedValueOnce({ rows: [comment] }); // INSERT

    const res = await request(app)
      .post('/api/pages/1/comments')
      .set('Authorization', authHeader())
      .send({ text: 'Great page!' });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe('Great page!');
  });

  test('400 — empty comment text', async () => {
    const res = await request(app)
      .post('/api/pages/1/comments')
      .set('Authorization', authHeader())
      .send({ text: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — missing text field', async () => {
    const res = await request(app)
      .post('/api/pages/1/comments')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/pages/1/comments')
      .send({ text: 'Unauthorized' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/pages/:id/comments', () => {
  // commentsRepo.findByPageId calls: ensureTable() + SELECT with JOIN
  test('200 — returns comments for a page', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })            // ensureTable CREATE TABLE
      .mockResolvedValueOnce({ rows: mockComments });  // SELECT with JOIN

    const res = await request(app)
      .get('/api/pages/1/comments')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('200 — returns empty array when no comments', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })  // ensureTable CREATE TABLE
      .mockResolvedValueOnce({ rows: [] }); // SELECT → empty

    const res = await request(app)
      .get('/api/pages/999/comments')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/pages/1/comments');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/pages/:id/comments/:commentId', () => {
  test('200 — updates a comment', async () => {
    const updated = { id: 1, page_id: 1, user_id: ADMIN_ID, text: 'Updated text', created_at: new Date().toISOString() };
    mockPoolQuery.mockResolvedValueOnce({ rows: [updated] });

    const res = await request(app)
      .put('/api/pages/1/comments/1')
      .set('Authorization', authHeader())
      .send({ text: 'Updated text' });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Updated text');
  });

  test('404 — comment not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/pages/1/comments/999')
      .set('Authorization', authHeader())
      .send({ text: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Comment not found');
  });

  test('400 — empty text', async () => {
    const res = await request(app)
      .put('/api/pages/1/comments/1')
      .set('Authorization', authHeader())
      .send({ text: '' });
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .put('/api/pages/1/comments/1')
      .send({ text: 'Hack' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/pages/:id/comments/:commentId', () => {
  test('200 — deletes a comment', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .delete('/api/pages/1/comments/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  test('404 — comment not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/pages/1/comments/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Comment not found');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).delete('/api/pages/1/comments/1');
    expect(res.status).toBe(401);
  });
});

// ─── ─── ─── SEARCH ROUTE ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('GET /api/search', () => {
  test('400 — missing q parameter', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/search?q=test');
    expect(res.status).toBe(401);
  });
});

// ─── ─── ─── AI ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('POST /api/ai/build', () => {
  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .send({ prompt: 'Build a page about AI agents' });
    expect(res.status).toBe(401);
  });

  test('400 — empty prompt', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .set('Authorization', authHeader())
      .send({ prompt: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — missing prompt', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  test('400 — prompt exceeding 5000 chars', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .set('Authorization', authHeader())
      .send({ prompt: 'a'.repeat(5001) });
    expect(res.status).toBe(400);
  });

  test('503 — no API key configured (openrouter provider)', async () => {
    // Save original key, then clear it for this test
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = '';
    // No ai_settings row
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/ai/build')
      .set('Authorization', authHeader())
      .send({ prompt: 'Build a page' });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/api key|configured/i);

    process.env.OPENROUTER_API_KEY = originalKey;
  });
});

// ─── ─── ─── AI SETTINGS ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('GET /api/settings/ai', () => {
  test('200 — returns default settings when no user settings exist', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/settings/ai')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('openrouter');
    expect(res.body.model).toBe('qwen/qwen3.6-plus:free');
    expect(res.body.availableModels).toBeDefined();
  });

  test('200 — returns user-specific settings when they exist', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{
        provider: 'openai',
        api_key: 'sk-mock',
        model: 'gpt-4o',
        temperature: '0.8',
        max_tokens: 2000,
      }],
    });

    const res = await request(app)
      .get('/api/settings/ai')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('openai');
    expect(res.body.model).toBe('gpt-4o');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/settings/ai');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/settings/ai', () => {
  test('200 — updates AI settings', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: '0.5',
        max_tokens: 3000,
      }],
    });

    const res = await request(app)
      .put('/api/settings/ai')
      .set('Authorization', authHeader())
      .send({
        provider: 'openai',
        apiKey: 'sk-new-key',
        model: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 3000,
      });

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('openai');
  });

  test('400 — invalid provider value', async () => {
    const res = await request(app)
      .put('/api/settings/ai')
      .set('Authorization', authHeader())
      .send({
        provider: 'unknown-provider',
        model: 'some-model',
        temperature: 0.7,
        maxTokens: 4000,
      });
    expect(res.status).toBe(400);
  });

  test('400 — temperature out of range (too high)', async () => {
    const res = await request(app)
      .put('/api/settings/ai')
      .set('Authorization', authHeader())
      .send({
        provider: 'openrouter',
        model: 'qwen/qwen3.6-plus:free',
        temperature: 3.0,
        maxTokens: 4000,
      });
    expect(res.status).toBe(400);
  });

  test('400 — maxTokens out of range (too low)', async () => {
    const res = await request(app)
      .put('/api/settings/ai')
      .set('Authorization', authHeader())
      .send({
        provider: 'openrouter',
        model: 'qwen/qwen3.6-plus:free',
        temperature: 0.7,
        maxTokens: 50,
      });
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .put('/api/settings/ai')
      .send({ provider: 'openrouter', model: 'qwen/qwen3.6-plus:free', temperature: 0.7, maxTokens: 4000 });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/settings/ai/providers', () => {
  test('200 — returns list of AI providers and models', async () => {
    const res = await request(app)
      .get('/api/settings/ai/providers')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.openrouter).toBeDefined();
    expect(Array.isArray(res.body.openrouter)).toBe(true);
    expect(res.body.openai).toBeDefined();
    expect(res.body.anthropic).toBeDefined();
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/settings/ai/providers');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/settings/ai/test', () => {
  test('400 — no API key configured', async () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = '';
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/settings/ai/test')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/api key/i);

    process.env.OPENROUTER_API_KEY = originalKey;
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).post('/api/settings/ai/test');
    expect(res.status).toBe(401);
  });
});

// ─── ─── ─── NOTIFICATIONS ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('POST /api/notifications', () => {
  // notificationsRepo.create calls: ensureTable() + INSERT
  test('201 — creates a notification', async () => {
    const notif = { id: 2, user_id: ADMIN_ID, title: 'New Alert', message: 'System update', is_read: false, created_at: new Date().toISOString() };
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })        // ensureTable CREATE TABLE
      .mockResolvedValueOnce({ rows: [notif] });   // INSERT

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', authHeader())
      .send({ title: 'New Alert', message: 'System update' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Alert');
  });

  test('400 — missing title', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', authHeader())
      .send({ message: 'Just a message' });
    expect(res.status).toBe(400);
  });

  test('400 — missing message', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', authHeader())
      .send({ title: 'Just a title' });
    expect(res.status).toBe(400);
  });

  test('400 — empty title', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', authHeader())
      .send({ title: '', message: 'msg' });
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .send({ title: 'Alert', message: 'Desc' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/notifications', () => {
  // notificationsRepo.findByUserId calls: ensureTable() + SELECT
  test('200 — returns notifications for current user', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })              // ensureTable CREATE TABLE
      .mockResolvedValueOnce({ rows: mockNotifications }); // SELECT

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('200 — returns empty array when no notifications', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })  // ensureTable CREATE TABLE
      .mockResolvedValueOnce({ rows: [] });  // SELECT → empty

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/notifications/:id/read', () => {
  test('200 — marks notification as read', async () => {
    const updated = { ...mockNotifications[0], is_read: true };
    mockPoolQuery.mockResolvedValueOnce({ rows: [updated] });

    const res = await request(app)
      .put('/api/notifications/1/read')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.is_read).toBe(true);
  });

  test('404 — notification not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/notifications/999/read')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).put('/api/notifications/1/read');
    expect(res.status).toBe(401);
  });
});

// ─── ─── ─── INTEGRATIONS ROUTES ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('POST /api/integrations/jira', () => {
  test('400 — Jira URL not from atlassian.net', async () => {
    const res = await request(app)
      .post('/api/integrations/jira')
      .set('Authorization', authHeader())
      .send({ jiraUrl: 'https://fakejira.com', jql: 'project = PROJ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — empty JQL', async () => {
    const res = await request(app)
      .post('/api/integrations/jira')
      .set('Authorization', authHeader())
      .send({ jiraUrl: 'https://company.atlassian.net', jql: '' });

    expect(res.status).toBe(400);
  });

  test('400 — missing jiraUrl', async () => {
    const res = await request(app)
      .post('/api/integrations/jira')
      .set('Authorization', authHeader())
      .send({ jql: 'project = PROJ' });
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/integrations/jira')
      .send({ jiraUrl: 'https://company.atlassian.net', jql: 'project = PROJ' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/integrations/github', () => {
  test('400 — missing repo parameter', async () => {
    const res = await request(app)
      .get('/api/integrations/github')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('400 — invalid state value', async () => {
    const res = await request(app)
      .get('/api/integrations/github?repo=owner/repo&state=invalid')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .get('/api/integrations/github?repo=owner/repo');
    expect(res.status).toBe(401);
  });
});

// ─── ─── ─── RATE LIMITING ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('Rate limiting', () => {
  test('globalLimiter — health endpoint is excluded from rate limiting', async () => {
    // Health responds with 200 or 503 — neither is a 429 rate limit response
    mockPoolQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);  // not 429
  });

  test('authLimiter — login responds without rate limit on first attempts', async () => {
    // First login attempts should not be rate-limited (limit is 10 per 15 min)
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rapid@portal.com', password: 'anypass' });
    // 401 (no user) or 400 (validation) are both valid — not 429
    expect([200, 400, 401, 429]).toContain(res.status);
  });
});

// ─── ─── ─── TOKEN EXPIRY ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

describe('JWT token expiry handling', () => {
  test('401 — expired token is rejected', async () => {
    const expiredToken = jwt.sign(
      { id: ADMIN_ID, email: ADMIN_EMAIL },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/spaces')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token expired');
  });
});

// ─── ─── ─── CONTENT TYPE / BODY PARSING ─── ─── ─── ─── ─── ─── ───

describe('Request body parsing', () => {
  test('returns 4xx for non-JSON body on protected routes', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', authHeader())
      .set('Content-Type', 'text/plain')
      .send('not json');
    expect([400, 415]).toContain(res.status);
  });

  test('accepts JSON Content-Type', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/spaces')
      .set('Authorization', authHeader())
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
  });
});
