import { Request, Response, NextFunction } from 'express';
import { JWT_SECRET } from '../config';
import { AuthService } from '../services/authService';
import { AuditService } from '../services/auditService';
import type { CompanyRole, DepartmentRole, ObjectRole } from '../types';

const authService = new AuthService();
const auditService = new AuditService();

/**
 * ─── Base JWT auth middleware ─────────────────────────────────────────────────
 * Extracts JWT from Authorization: Bearer *** header, verifies it,
 * and attaches the full user profile to req.user.
 *
 * Public routes should NOT use this — use optionalAuthMiddleware instead.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = authService.decodeToken(token);

  if (!payload) {
    // decodeToken returns null for expired/invalid — treat both as 403
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach minimal payload now; full profile loaded lazily if needed
  req.user = {
    id: payload.userId,
    email: payload.email,
    username: payload.email.split('@')[0],
    companyId: payload.companyId,
    companyRole: payload.companyRole as CompanyRole,
    departmentRoles: [],
    objectRoles: [],
  };
  req.requestId = (req.headers['x-request-id'] as string) || undefined;

  next();
}

/**
 * ─── Optional auth middleware ─────────────────────────────────────────────────
 * Like authMiddleware but does NOT reject unauthenticated requests.
 * Use for routes that work both authenticated and anonymously.
 */
export function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = authService.decodeToken(token);
  if (!payload) {
    next();
    return;
  }

  req.user = {
    id: payload.userId,
    email: payload.email,
    username: payload.email.split('@')[0],
    companyId: payload.companyId,
    companyRole: payload.companyRole as CompanyRole,
    departmentRoles: [],
    objectRoles: [],
  };
  req.requestId = (req.headers['x-request-id'] as string) || undefined;

  next();
}

/**
 * ─── Company-level RBAC ───────────────────────────────────────────────────────
 * requireRole(...roles) — returns 403 if user's company role is not in the list.
 * Role hierarchy (highest → lowest): super_admin > admin > employee > guest
 */
export function requireRole(...roles: CompanyRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.companyRole)) {
      auditService.logPermissionDenied(
        req.user.companyId,
        req.user.id,
        `requireRole(${roles.join(', ')})`,
        'company',
        req.user.companyId
      );
      res.status(403).json({ error: 'Forbidden: insufficient company-level role' });
      return;
    }

    next();
  };
}

/**
 * ─── Department-level RBAC ───────────────────────────────────────────────────
 * requireDepartmentRole(departmentId, ...roles) — checks user's role in a department.
 * Department Head outranks Member.
 */
export function requireDepartmentRole(departmentId: string, ...roles: DepartmentRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // If user's company role is super_admin or admin, bypass department checks
    if (req.user.companyRole === 'super_admin' || req.user.companyRole === 'admin') {
      next();
      return;
    }

    const deptRole = req.user.departmentRoles.find((r: { departmentId: string; role: DepartmentRole }) => r.departmentId === departmentId);
    if (!deptRole || !roles.includes(deptRole.role)) {
      auditService.logPermissionDenied(
        req.user.companyId,
        req.user.id,
        `requireDepartmentRole(${departmentId}, ${roles.join(', ')})`,
        'department',
        departmentId
      );
      res.status(403).json({ error: 'Forbidden: insufficient department-level role' });
      return;
    }

    next();
  };
}

/**
 * ─── Space/Board/Page object-level RBAC ─────────────────────────────────────
 * requireObjectRole(objectType, objectId, ...roles) — checks user's role on a specific object.
 * Role hierarchy: owner > editor > viewer
 *
 * objectType: 'space' | 'board' | 'page'
 */
export function requireObjectRole(objectType: 'space' | 'board' | 'page', objectId: string, ...roles: ObjectRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // super_admin / admin bypass object-level checks
    if (req.user.companyRole === 'super_admin' || req.user.companyRole === 'admin') {
      next();
      return;
    }

    const objRole = req.user.objectRoles.find(
      (r: { objectType: string; objectId: string; role: ObjectRole }) => r.objectType === objectType && r.objectId === objectId
    );

    if (!objRole || !roles.includes(objRole.role)) {
      auditService.logPermissionDenied(
        req.user.companyId,
        req.user.id,
        `requireObjectRole(${objectType}, ${objectId}, ${roles.join(', ')})`,
        objectType,
        objectId
      );
      res.status(403).json({ error: 'Forbidden: insufficient object-level permission' });
      return;
    }

    next();
  };
}

/**
 * ─── Super Admin only ─────────────────────────────────────────────────────────
 * Convenience wrapper — only super_admin can proceed.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole('super_admin')(req, res, next);
}

/**
 * ─── Admin or higher ─────────────────────────────────────────────────────────
 * Convenience wrapper — super_admin or admin can proceed.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole('super_admin', 'admin')(req, res, next);
}
