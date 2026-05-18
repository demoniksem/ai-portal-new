import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

interface RequestWithId extends Request {
  requestId?: string;
}

function requestLoggerMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[level]({
      msg: `${method} ${url}`,
      method,
      url,
      status: statusCode,
      duration,
      requestId: req.requestId,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}

export { requestLoggerMiddleware };