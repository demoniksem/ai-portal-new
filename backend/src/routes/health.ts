import { Router, Response } from 'express';
import { pool, redisClient, meiliClient } from '../config';
import { logger } from '../config/logger';

const router: Router = Router();

// GET /api/health — liveness probe (DB + MeiliSearch must be up)
router.get('/', async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || 'unknown';
  try {
    const checks = {
      postgres: false,
      redis: false,
      meilisearch: false,
      uptime: process.uptime(),
    };

    try {
      await pool.query('SELECT 1');
      checks.postgres = true;
    } catch (e) {
      checks.postgres = false;
    }

    try {
      await redisClient.ping();
      checks.redis = true;
    } catch (e) {
      checks.redis = false;
    }

    try {
      const health = await meiliClient.health();
      checks.meilisearch = health.status === 'available';
    } catch (e) {
      checks.meilisearch = false;
    }

    // Liveness: healthy if postgres + meilisearch are up (redis is best-effort cache)
    const isHealthy = checks.postgres && checks.meilisearch;
    const status = isHealthy ? 'healthy' : 'degraded';
    const statusCode = isHealthy ? 200 : 503;

    logger.info({ msg: 'Health check', status, checks, duration: Date.now() - start, requestId });
    res.status(statusCode).json({ status, checks });
  } catch (e) {
    logger.error({ msg: 'Health check error', error: (e as Error).message, duration: Date.now() - start, requestId });
    res.status(503).json({ status: 'unhealthy', error: (e as Error).message });
  }
});

// GET /api/health/ready — readiness probe (all dependencies must be up)
router.get('/ready', async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || 'unknown';
  try {
    const checks = {
      postgres: false,
      redis: false,
      meilisearch: false,
    };

    await Promise.all([
      pool.query('SELECT 1').then(() => { checks.postgres = true; }).catch(() => {}),
      redisClient.ping().then(() => { checks.redis = true; }).catch(() => {}),
      meiliClient.health().then((h: { status: string }) => { checks.meilisearch = h.status === 'available'; }).catch(() => {}),
    ]);

    const isReady = checks.postgres && checks.redis && checks.meilisearch;
    const status = isReady ? 'ready' : 'not_ready';
    const statusCode = isReady ? 200 : 503;

    logger.info({ msg: 'Readiness check', status, checks, duration: Date.now() - start, requestId });
    res.status(statusCode).json({ status, checks });
  } catch (e) {
    logger.error({ msg: 'Readiness check error', error: (e as Error).message, duration: Date.now() - start, requestId });
    res.status(503).json({ status: 'not_ready', error: (e as Error).message });
  }
});

export default router;