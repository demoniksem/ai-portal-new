import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

const redisClient: RedisClientType = createClient({ url: process.env.REDIS_URL });

redisClient.on('error', (err: Error) => {
  logger.error({ msg: 'Redis Client Error', error: err.message });
});

export { redisClient };