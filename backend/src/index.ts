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
import { initializeDatabase } from './db/init';

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
void initializeDatabase();

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
