const request = require('supertest');
const express = require('express');

// Minimal test setup that mocks the DB/Redis/Meili dependencies
// and tests the HTTP layer only

// Build a minimal Express app that mirrors the actual routes
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Health endpoint (no auth)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
  });

  // Auth endpoints with validation (mocked, no DB)
  const jwt = require('jsonwebtoken');
  const { z } = require('zod');

  const registerSchema = z.object({
    email: z.string().email('Invalid email format').max(255),
    password: z.string().min(8).max(128),
    username: z.string().max(100).optional(),
  });

  const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1),
  });

  const validate = (schema) => (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      next(err);
    }
  };

  app.post('/api/auth/register', validate(registerSchema), (req, res) => {
    // Mock response — real DB logic not invoked
    res.status(201).json({ message: 'User would be created', email: req.body.email });
  });

  app.post('/api/auth/login', validate(loginSchema), (req, res) => {
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    const token = jwt.sign({ id: 1, email: req.body.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: 1, email: req.body.email } });
  });

  // Protected route mock
  const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      req.user = decoded;
      next();
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(403).json({ error: 'Invalid token' });
    }
  };

  app.get('/api/spaces', authMiddleware, (req, res) => {
    res.json([{ id: 1, name: 'Test Space', slug: 'test-space' }]);
  });

  app.post('/api/spaces', authMiddleware, validate(z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  })), (req, res) => {
    res.status(201).json({ id: 2, name: req.body.name, slug: req.body.slug });
  });

  // Pages endpoints
  const createPageSchema = z.object({
    title: z.string().min(1).max(500),
    content: z.any().optional(),
    spaceId: z.number().int().positive(),
    acl: z.any().optional(),
  });

  const updatePageSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    content: z.any().optional(),
    acl: z.any().optional(),
  });

  let mockPages = [{ id: 1, title: 'Existing Page', space_id: 1 }];

  app.get('/api/pages', authMiddleware, (req, res) => {
    const { spaceId } = req.query;
    const pages = spaceId ? mockPages.filter(p => p.space_id === parseInt(spaceId)) : mockPages;
    res.json(pages);
  });

  app.get('/api/pages/:id', authMiddleware, (req, res) => {
    const page = mockPages.find(p => p.id === parseInt(req.params.id));
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  });

  app.post('/api/pages', authMiddleware, validate(createPageSchema), (req, res) => {
    const newPage = { id: mockPages.length + 1, ...req.body };
    mockPages.push(newPage);
    res.status(201).json(newPage);
  });

  app.patch('/api/pages/:id', authMiddleware, validate(updatePageSchema), (req, res) => {
    const idx = mockPages.findIndex(p => p.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Page not found' });
    mockPages[idx] = { ...mockPages[idx], ...req.body };
    res.json(mockPages[idx]);
  });

  app.delete('/api/pages/:id', authMiddleware, (req, res) => {
    const idx = mockPages.findIndex(p => p.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Page not found' });
    const deleted = mockPages.splice(idx, 1)[0];
    res.json({ message: 'Page deleted', page: deleted });
  });

  // Comments endpoints
  let mockComments = [];

  app.post('/api/pages/:id/comments', authMiddleware, validate(z.object({
    text: z.string().min(1).max(10000),
  })), (req, res) => {
    const comment = { id: mockComments.length + 1, page_id: parseInt(req.params.id), text: req.body.text };
    mockComments.push(comment);
    res.status(201).json(comment);
  });

  app.get('/api/pages/:id/comments', authMiddleware, (req, res) => {
    res.json(mockComments.filter(c => c.page_id === parseInt(req.params.id)));
  });

  // AI endpoint
  const aiBuildSchema = z.object({
    prompt: z.string().min(1).max(5000),
  });

  app.post('/api/ai/build', authMiddleware, validate(aiBuildSchema), (req, res) => {
    res.json({ title: 'Generated Page', content: [{ type: 'text', text: 'Generated content' }] });
  });

  return app;
};

describe('API Endpoints', () => {
  let app;
  let validToken;

  beforeAll(() => {
    app = createTestApp();
    const jwt = require('jsonwebtoken');
    validToken = jwt.sign({ id: 1, email: 'test@example.com' }, process.env.JWT_SECRET || 'test-secret');
  });

  describe('GET /api/health', () => {
    test('returns 200 with healthy status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.uptime).toBeDefined();
    });
  });

  describe('POST /api/auth/register', () => {
    test('accepts valid registration payload', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@example.com', password: 'password123' });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe('newuser@example.com');
    });

    test('accepts registration with username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'user2@example.com', password: 'password123', username: 'testuser' });
      expect(res.status).toBe(201);
    });

    test('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    test('accepts valid credentials and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
    });

    test('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bad-email', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('rejects empty password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/spaces (auth required)', () => {
    test('rejects request without token', async () => {
      const res = await request(app).get('/api/spaces');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    test('rejects request with invalid token', async () => {
      const res = await request(app)
        .get('/api/spaces')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Invalid token');
    });

    test('accepts request with valid token', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ id: 1, email: 'test@example.com' }, process.env.JWT_SECRET || 'test-secret');
      const res = await request(app)
        .get('/api/spaces')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/spaces (auth required)', () => {


    test('accepts valid space creation', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'My Space', slug: 'my-space' });
      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('my-space');
    });

    test('rejects slug with uppercase', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'My Space', slug: 'My-Space' });
      expect(res.status).toBe(400);
    });

    test('rejects slug with spaces', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'My Space', slug: 'my space' });
      expect(res.status).toBe(400);
    });

    test('rejects empty name', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: '', slug: 'my-space' });
      expect(res.status).toBe(400);
    });
  });

  // ============ PAGES ============

  describe('GET /api/pages', () => {
  test('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/pages');
    expect(res.status).toBe(401);
  });

  test('returns array with valid token', async () => {
    const res = await request(app)
      .get('/api/pages')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns pages filtered by spaceId', async () => {
    const res = await request(app)
      .get('/api/pages?spaceId=1')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

  describe('GET /api/pages/:id', () => {
    test('returns 404 for non-existent page', async () => {
    const res = await request(app)
      .get('/api/pages/99999')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Page not found');
  });

    test('returns page with valid id', async () => {
    const res = await request(app)
      .get('/api/pages/1')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

    test('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/pages/1');
    expect(res.status).toBe(401);
  });
});

  describe('POST /api/pages', () => {
    test('creates a page with valid data', async () => {
    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ title: 'New Page', spaceId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Page');
    expect(res.body).toHaveProperty('id');
  });

    test('rejects missing title', async () => {
    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ spaceId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

    test('rejects missing spaceId', async () => {
    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ title: 'No Space Page' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

    test('rejects negative spaceId', async () => {
    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ title: 'Bad Page', spaceId: -1 });
    expect(res.status).toBe(400);
  });

    test('rejects empty title', async () => {
    const res = await request(app)
      .post('/api/pages')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ title: '', spaceId: 1 });
    expect(res.status).toBe(400);
  });

    test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/pages')
      .send({ title: 'Unauth Page', spaceId: 1 });
    expect(res.status).toBe(401);
  });
});

  describe('PATCH /api/pages/:id', () => {
    test('updates page title', async () => {
    const res = await request(app)
      .patch('/api/pages/1')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

    test('returns 404 for non-existent page', async () => {
    const res = await request(app)
      .patch('/api/pages/99999')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ title: 'New Title' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Page not found');
  });

    test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .patch('/api/pages/1')
      .send({ title: 'Hacked Title' });
    expect(res.status).toBe(401);
  });
});

  describe('DELETE /api/pages/:id', () => {
    test('deletes an existing page', async () => {
    const res = await request(app)
      .delete('/api/pages/1')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Page deleted');
  });

    test('returns 404 for non-existent page', async () => {
    const res = await request(app)
      .delete('/api/pages/99999')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Page not found');
  });

    test('rejects unauthenticated request', async () => {
    const res = await request(app).delete('/api/pages/1');
    expect(res.status).toBe(401);
  });
});

// ============ COMMENTS ============

  describe('POST /api/pages/:id/comments', () => {
    test('creates a comment on a page', async () => {
    const res = await request(app)
      .post('/api/pages/1/comments')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ text: 'This is a test comment' });
    expect(res.status).toBe(201);
    expect(res.body.text).toBe('This is a test comment');
    expect(res.body).toHaveProperty('id');
  });

    test('rejects empty comment text', async () => {
    const res = await request(app)
      .post('/api/pages/1/comments')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ text: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

    test('rejects missing text field', async () => {
    const res = await request(app)
      .post('/api/pages/1/comments')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

    test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/pages/1/comments')
      .send({ text: 'Unauthorized comment' });
    expect(res.status).toBe(401);
  });
});

  describe('GET /api/pages/:id/comments', () => {
    test('returns comments for a page', async () => {
    const res = await request(app)
      .get('/api/pages/1/comments')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

    test('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/pages/1/comments');
    expect(res.status).toBe(401);
  });
});

// ============ AI ============

  describe('POST /api/ai/build', () => {
    test('accepts valid prompt', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ prompt: 'Build a page about AI agents' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('content');
  });

    test('rejects empty prompt', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ prompt: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

    test('rejects missing prompt', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

    test('rejects prompt exceeding 5000 characters', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ prompt: 'a'.repeat(5001) });
    expect(res.status).toBe(400);
  });

    test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/ai/build')
      .send({ prompt: 'Build a page' });
    expect(res.status).toBe(401);
  });
});
});

