import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { getMeiliClient, MeiliClientType } from './meilisearch';
import { logger } from './logger';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redisClient: RedisClientType = createClient({ url: process.env.REDIS_URL });
// Lazy MeiliSearch client — gracefully degrades when not configured
const meiliClient = getMeiliClient();

const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  logger.fatal({ msg: 'JWT_SECRET environment variable is required' });
  process.exit(1);
}
if (JWT_SECRET === 'supersecret' || JWT_SECRET === 'changeme') {
  logger.fatal({ msg: 'JWT_SECRET must be changed from default value' });
  process.exit(1);
}
const JWT_EXPIRY: string = process.env.JWT_EXPIRY || '24h';
const OPENROUTER_KEY: string = process.env.OPENROUTER_API_KEY || '';
const OPENCLAW_GATEWAY_URL: string = process.env.OPENCLAW_GATEWAY_URL || '';
const PORT: number | string = process.env.PORT || 3001;
const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

export type { MeiliClientType };
export { pool, redisClient, meiliClient, JWT_SECRET, JWT_EXPIRY, OPENROUTER_KEY, OPENCLAW_GATEWAY_URL, PORT, ALLOWED_ORIGINS };
