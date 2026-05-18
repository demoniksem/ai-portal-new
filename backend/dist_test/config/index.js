"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_ORIGINS = exports.PORT = exports.OPENCLAW_GATEWAY_URL = exports.OPENROUTER_KEY = exports.JWT_EXPIRY = exports.JWT_SECRET = exports.meiliClient = exports.redisClient = exports.pool = void 0;
const pg_1 = require("pg");
const redis_1 = require("redis");
const meilisearch_1 = require("./meilisearch");
const logger_1 = require("./logger");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
exports.pool = pool;
const redisClient = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
exports.redisClient = redisClient;
// Lazy MeiliSearch client — gracefully degrades when not configured
const meiliClient = (0, meilisearch_1.getMeiliClient)();
exports.meiliClient = meiliClient;
const JWT_SECRET = process.env.JWT_SECRET || '';
exports.JWT_SECRET = JWT_SECRET;
if (!JWT_SECRET) {
    logger_1.logger.fatal({ msg: 'JWT_SECRET environment variable is required' });
    process.exit(1);
}
if (JWT_SECRET === 'supersecret' || JWT_SECRET === 'changeme') {
    logger_1.logger.fatal({ msg: 'JWT_SECRET must be changed from default value' });
    process.exit(1);
}
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
exports.JWT_EXPIRY = JWT_EXPIRY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
exports.OPENROUTER_KEY = OPENROUTER_KEY;
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || '';
exports.OPENCLAW_GATEWAY_URL = OPENCLAW_GATEWAY_URL;
const PORT = process.env.PORT || 3001;
exports.PORT = PORT;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
exports.ALLOWED_ORIGINS = ALLOWED_ORIGINS;
//# sourceMappingURL=index.js.map