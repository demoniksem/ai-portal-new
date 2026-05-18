import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

interface RequestWithId extends Request {
  requestId?: string;
}

function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id'] as string || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export { requestIdMiddleware };
