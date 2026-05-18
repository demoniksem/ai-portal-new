"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
const pinoFn = require('pino');
const pinoLib = typeof pinoFn === 'function' ? pinoFn : pinoFn.default ?? pinoFn;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';
const logger = pinoLib({
    level: LOG_LEVEL,
    formatters: {
        level: (label) => ({ level: label }),
    },
    base: {
        service: 'ai-portal-backend',
    },
    timestamp: pinoLib.stdTimeFunctions.isoTime,
    ...(isProduction
        ? {}
        : {
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            },
        }),
});
exports.logger = logger;
//# sourceMappingURL=logger.js.map