"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const redis_1 = require("redis");
const logger_1 = require("./logger");
const redisClient = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
exports.redisClient = redisClient;
redisClient.on('error', (err) => {
    logger_1.logger.error({ msg: 'Redis Client Error', error: err.message });
});
//# sourceMappingURL=redis.js.map