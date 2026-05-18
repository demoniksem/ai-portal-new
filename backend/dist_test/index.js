'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const middleware_1 = require("./middleware");
const logger_1 = require("./config/logger");
const routes_1 = require("./routes");
const app = (0, express_1.default)();
// ==================== MIDDLEWARE ====================
app.use(middleware_1.requestIdMiddleware);
app.use(middleware_1.requestLoggerMiddleware);
app.use(middleware_1.corsMiddleware);
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
app.use(middleware_1.globalLimiter);
// Serve uploaded files at /api/uploads/:filename
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
app.use('/api/uploads', express_1.default.static(uploadsDir));
// ==================== DATABASE INIT ====================
(async () => {
    try {
        await config_1.pool.query(`
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
        logger_1.logger.info({ msg: 'DB tables initialized' });
        // NOTE: No default admin is created. The first user to register should be
        // granted Super Admin role via an out-of-band bootstrap process or environment
        // variable (e.g., INITIAL_ADMIN_EMAIL). Static default credentials are prohibited
        // per SPEC section 6.11.
        // MeiliSearch index setup
        try {
            const indexes = await config_1.meiliClient.getIndexes();
            const hasPagesIndex = indexes.results?.some(idx => idx.uid === 'pages');
            if (!hasPagesIndex) {
                await config_1.meiliClient.createIndex('pages', { primaryKey: 'id' });
                await config_1.meiliClient.index('pages').updateSearchableAttributes(['title', 'content']);
                logger_1.logger.info({ msg: 'MeiliSearch index "pages" created' });
            }
        }
        catch (e) {
            const err = e;
            logger_1.logger.warn({ msg: 'MeiliSearch index setup note', error: err.message });
        }
    }
    catch (e) {
        const err = e;
        logger_1.logger.error({ msg: 'DB init error', error: err.message });
    }
})();
// ==================== ROUTES ====================
app.use('/api/auth', routes_1.authRouter);
app.use('/api/spaces', routes_1.spacesRouter);
app.use('/api/pages', routes_1.pagesRouter);
app.use('/api/search', routes_1.searchRouter);
app.use('/api/ai', routes_1.aiRouter);
app.use('/api/settings/ai', routes_1.aiSettingsRouter);
app.use('/api/notifications', routes_1.notificationsRouter);
app.use('/api/integrations', routes_1.integrationsRouter);
app.use('/api/health', routes_1.healthRouter);
app.use('/api/boards', routes_1.boardsRouter);
app.use('/api/cards', routes_1.cardsRouter);
app.use('/api/home', routes_1.homeRouter);
app.use('/api/admin', routes_1.adminRouter);
app.use('/api/admin/ai-config', routes_1.aiConfigRouter);
// ==================== SERVER ====================
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    logger_1.logger.info({ msg: `AI Portal backend started`, port: PORT });
});
process.on('SIGTERM', () => {
    logger_1.logger.info({ msg: 'SIGTERM received, shutting down gracefully' });
    server.close(() => {
        logger_1.logger.info({ msg: 'HTTP server closed' });
        config_1.pool.end(() => {
            logger_1.logger.info({ msg: 'DB pool closed' });
            process.exit(0);
        });
    });
});
process.on('SIGINT', () => {
    logger_1.logger.info({ msg: 'SIGINT received, shutting down gracefully' });
    server.close(() => {
        logger_1.logger.info({ msg: 'HTTP server closed' });
        config_1.pool.end(() => {
            logger_1.logger.info({ msg: 'DB pool closed' });
            process.exit(0);
        });
    });
});
//# sourceMappingURL=index.js.map