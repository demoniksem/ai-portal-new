"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
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
            await config_1.pool.query('SELECT 1');
            checks.postgres = true;
        }
        catch (e) {
            checks.postgres = false;
        }
        try {
            await config_1.redisClient.ping();
            checks.redis = true;
        }
        catch (e) {
            checks.redis = false;
        }
        try {
            const health = await config_1.meiliClient.health();
            checks.meilisearch = health.status === 'available';
        }
        catch (e) {
            checks.meilisearch = false;
        }
        // Liveness: healthy if postgres + meilisearch are up (redis is best-effort cache)
        const isHealthy = checks.postgres && checks.meilisearch;
        const status = isHealthy ? 'healthy' : 'degraded';
        const statusCode = isHealthy ? 200 : 503;
        logger_1.logger.info({ msg: 'Health check', status, checks, duration: Date.now() - start, requestId });
        res.status(statusCode).json({ status, checks });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Health check error', error: e.message, duration: Date.now() - start, requestId });
        res.status(503).json({ status: 'unhealthy', error: e.message });
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
            config_1.pool.query('SELECT 1').then(() => { checks.postgres = true; }).catch(() => { }),
            config_1.redisClient.ping().then(() => { checks.redis = true; }).catch(() => { }),
            config_1.meiliClient.health().then((h) => { checks.meilisearch = h.status === 'available'; }).catch(() => { }),
        ]);
        const isReady = checks.postgres && checks.redis && checks.meilisearch;
        const status = isReady ? 'ready' : 'not_ready';
        const statusCode = isReady ? 200 : 503;
        logger_1.logger.info({ msg: 'Readiness check', status, checks, duration: Date.now() - start, requestId });
        res.status(statusCode).json({ status, checks });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Readiness check error', error: e.message, duration: Date.now() - start, requestId });
        res.status(503).json({ status: 'not_ready', error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=health.js.map