import { Request } from 'express';

// Augment Express Request to include custom properties set by middleware
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string };
      requestId?: string;
    }
  }
}

export {};
