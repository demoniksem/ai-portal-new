'use strict';

import express, { Express } from 'express';
import { promisify } from 'util';
import path from 'path';
import { pool, redisClient, meiliClient, JWT_SECRET, JWT_EXPIRY } from './config';
import { globalLimiter, corsMiddleware, requestIdMiddleware, requestLoggerMiddleware } from './middleware';
import { logger } from './config/logger';
import {
  authRouter,
  spacesRouter,
  pagesRouter,
  searchRouter,
  aiRouter,
  aiSettingsRouter,
  notificationsRouter,
  integrationsRouter,
  healthRouter,
  adminRouter,
  boardsRouter,
  cardsRouter,
  homeRouter,
  aiConfigRouter,
} from './routes';

const app: Express = express();

// ==================== MIDDLEWARE ====================
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(globalLimiter);

// Serve uploaded files at /api/uploads/:filename
const uploadsDir = path.join(__dirname, '../../uploads');
app.use('/api/uploads', express.static(uploadsDir));

// ==================== DATABASE INIT ====================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS spaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        space_id INT REFERENCES spaces(id),
        title VARCHAR(255) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        acl JSONB NOT NULL DEFAULT '{}',
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_settings (
        id SERIAL PRIMARY KEY,
        user_id INT UNIQUE REFERENCES users(id),
        provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
        api_key TEXT,
        model VARCHAR(255) NOT NULL DEFAULT 'qwen/qwen3.6-plus:free',
        temperature DECIMAL(3,2) NOT NULL DEFAULT 0.70,
        max_tokens INT NOT NULL DEFAULT 4000,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    logger.info({ msg: 'DB tables initialized' });

    // NOTE: No default admin is created. The first user to register should be
    // granted Super Admin role via an out-of-band bootstrap process or environment
    // variable (e.g., INITIAL_ADMIN_EMAIL). Static default credentials are prohibited
    // per SPEC section 6.11.

    // MeiliSearch index setup
    try {
      const indexes = await meiliClient.getIndexes();
      const hasPagesIndex = indexes.results?.some(idx => idx.uid === 'pages');
      if (!hasPagesIndex) {
        await meiliClient.createIndex('pages', { primaryKey: 'id' });
        await meiliClient.index('pages').updateSearchableAttributes(['title', 'content']);
        logger.info({ msg: 'MeiliSearch index "pages" created' });
      }
    } catch (e) {
      const err = e as Error;
      logger.warn({ msg: 'MeiliSearch index setup note', error: err.message });
    }

  } catch (e) {
    const err = e as Error;
    logger.error({ msg: 'DB init error', error: err.message });
  }
})();

// ==================== ROUTES ====================
app.use('/api/auth', authRouter);
app.use('/api/spaces', spacesRouter);
app.use('/api/pages', pagesRouter);
app.use('/api/search', searchRouter);
app.use('/api/ai', aiRouter);
app.use('/api/settings/ai', aiSettingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/health', healthRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/home', homeRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/ai-config', aiConfigRouter);

// ==================== SERVER ====================
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info({ msg: `AI Portal backend started`, port: PORT });
});

process.on('SIGTERM', () => {
  logger.info({ msg: 'SIGTERM received, shutting down gracefully' });
  server.close(() => {
    logger.info({ msg: 'HTTP server closed' });
    pool.end(() => {
      logger.info({ msg: 'DB pool closed' });
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info({ msg: 'SIGINT received, shutting down gracefully' });
  server.close(() => {
    logger.info({ msg: 'HTTP server closed' });
    pool.end(() => {
      logger.info({ msg: 'DB pool closed' });
      process.exit(0);
    });
  });
});
