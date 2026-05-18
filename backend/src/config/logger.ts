/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
const pinoFn: any = require('pino');
const pinoLib = typeof pinoFn === 'function' ? pinoFn : (pinoFn as any).default ?? pinoFn;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

const logger = pinoLib({
  level: LOG_LEVEL,
  formatters: {
    level: (label: string) => ({ level: label }),
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

export { logger };
