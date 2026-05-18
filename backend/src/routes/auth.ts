import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { AuthService } from '../services/authService';
import { AuditService } from '../services/auditService';
import { authLimiter } from '../middleware';
import { registerSchema, loginSchema } from '../schemas';
import { validate } from '../middleware/validation';
import { authMiddleware } from '../middleware/rbac';

const router: Router = Router();
const authService = new AuthService();
const auditService = new AuditService();

// ─── Request body types ────────────────────────────────────────────────────────

interface RegisterBody {
  email: string;
  password: string;
  username?: string;
  fullName?: string;
  companyId: string;
}

interface LoginBody {
  email: string;
  password: string;
  companyId: string;
}

// ─── Public routes ─────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, companyId, fullName, username } = req.body as unknown as RegisterBody;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const result = await authService.register({ email, password, companyId, fullName, username });

    if ('error' in result) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }

    // Set httpOnly cookie with JWT
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });

    return res.status(201).json({ token: result.token, user: result.user });
  } catch (e) {
    logger.error({ msg: 'Register error', error: (e as Error).message, requestId: req.requestId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, companyId } = req.body as unknown as LoginBody;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const result = await authService.login({ email, password, companyId });

    if ('error' in result) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }

    // Set httpOnly cookie with JWT
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({ token: result.token, user: result.user });
  } catch (e) {
    logger.error({ msg: 'Login error', error: (e as Error).message, requestId: req.requestId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (user?.companyId) {
      await auditService.logUserLogout(user.companyId, user.id);
    }
  } catch (e) {
    logger.error({ msg: 'Logout audit error', error: (e as Error).message });
  }
  // Clear the httpOnly cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me — returns current authenticated user
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    // req.user is already set by authMiddleware from JWT
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await authService.me(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    return res.json({ user });
  } catch (e) {
    logger.error({ msg: 'Me error', error: (e as Error).message, requestId: req.requestId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
