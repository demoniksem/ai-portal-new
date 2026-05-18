'use strict';

/**
 * Rate Limiter middleware unit tests
 * Tests express-rate-limit behaviour by hitting an Express app
 * through supertest with controlled time windows.
 */

const request = require('supertest');
const express = require('express');

// Import actual rate limiter middleware
const { globalLimiter, authLimiter, aiLimiter } = require('../src/middleware/rateLimiter');

describe('Rate Limiter Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('globalLimiter', () => {
    test('allows requests under the rate limit', async () => {
      app.use(globalLimiter);
      app.get('/test', (req, res) => res.json({ ok: true }));

      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('returns rate limit headers', async () => {
      app.use(globalLimiter);
      app.get('/test', (req, res) => res.json({ ok: true }));

      const res = await request(app).get('/test');
      // express-rate-limit sets RateLimit-* headers
      expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).toBeDefined();
    });

    test('skips rate limiting for /api/health path', async () => {
      app.use(globalLimiter);
      app.get('/api/health', (req, res) => res.json({ status: 'healthy' }));

      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    });

    test('returns 429 after exceeding global limit (500 req / 15 min)', async () => {
      app.use(globalLimiter);
      app.get('/test', (req, res) => res.json({ ok: true }));

      // Hit the limit
      const exceedLimit = 501;
      for (let i = 0; i < exceedLimit; i++) {
        const res = await request(app).get('/test');
        if (res.status === 429) {
          expect(res.body.error).toBe('Too many requests, please try again later.');
          return;
        }
      }
      // If we get here without hitting 429, fail
      throw new Error('Did not hit rate limit after 501 requests');
    });
  });

  describe('authLimiter', () => {
    test('allows requests under the auth rate limit', async () => {
      app.use(authLimiter);
      app.post('/login', (req, res) => res.json({ ok: true }));

      const res = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(200);
    });

    test('returns 429 after exceeding auth limit (10 req / 15 min)', async () => {
      app.use(authLimiter);
      app.post('/login', (req, res) => res.json({ ok: true }));

      const exceedLimit = 11;
      for (let i = 0; i < exceedLimit; i++) {
        const res = await request(app)
          .post('/login')
          .send({ email: 'test@example.com', password: 'password123' });
        if (res.status === 429) {
          expect(res.body.error).toBe('Too many authentication attempts, please try again later.');
          return;
        }
      }
      throw new Error('Did not hit auth rate limit after 11 requests');
    });
  });

  describe('aiLimiter', () => {
    test('allows requests under the AI rate limit', async () => {
      app.use(aiLimiter);
      app.post('/ai/build', (req, res) => res.json({ ok: true }));

      const res = await request(app)
        .post('/ai/build')
        .send({ prompt: 'Build a page about AI agents' });
      expect(res.status).toBe(200);
    });

    test('returns 429 after exceeding AI limit (5 req / 1 min)', async () => {
      app.use(aiLimiter);
      app.post('/ai/build', (req, res) => res.json({ ok: true }));

      const exceedLimit = 6;
      for (let i = 0; i < exceedLimit; i++) {
        const res = await request(app)
          .post('/ai/build')
          .send({ prompt: 'Build a page' });
        if (res.status === 429) {
          expect(res.body.error).toBe('AI generation rate limit exceeded. Please wait before generating more pages.');
          return;
        }
      }
      throw new Error('Did not hit AI rate limit after 6 requests');
    });
  });
});
