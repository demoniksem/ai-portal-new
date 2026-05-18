import { Request, Response, NextFunction } from 'express';
import { JWT_SECRET } from '../config';
import * as jwt from 'jsonwebtoken';

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; username?: string };
    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username || decoded.email.split('@')[0],
      companyId: '',
      companyRole: 'guest',
      departmentRoles: [],
      objectRoles: [],
    };
    req.requestId = (req.headers['x-request-id'] as string) || undefined;
    next();
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(403).json({ error: 'Invalid token' });
  }
}

export { authMiddleware };
