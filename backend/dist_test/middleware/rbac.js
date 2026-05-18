"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
exports.requireRole = requireRole;
exports.requireDepartmentRole = requireDepartmentRole;
exports.requireObjectRole = requireObjectRole;
exports.requireSuperAdmin = requireSuperAdmin;
exports.requireAdmin = requireAdmin;
const authService_1 = require("../services/authService");
const auditService_1 = require("../services/auditService");
const authService = new authService_1.AuthService();
const auditService = new auditService_1.AuditService();
/**
 * ─── Base JWT auth middleware ─────────────────────────────────────────────────
 * Extracts JWT from Authorization: Bearer *** header, verifies it,
 * and attaches the full user profile to req.user.
 *
 * Public routes should NOT use this — use optionalAuthMiddleware instead.
 */
function authMiddleware(req, res, next) {
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
        companyRole: payload.companyRole,
        departmentRoles: [],
        objectRoles: [],
    };
    req.requestId = req.headers['x-request-id'] || undefined;
    next();
}
/**
 * ─── Optional auth middleware ─────────────────────────────────────────────────
 * Like authMiddleware but does NOT reject unauthenticated requests.
 * Use for routes that work both authenticated and anonymously.
 */
function optionalAuthMiddleware(req, _res, next) {
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
        companyRole: payload.companyRole,
        departmentRoles: [],
        objectRoles: [],
    };
    req.requestId = req.headers['x-request-id'] || undefined;
    next();
}
/**
 * ─── Company-level RBAC ───────────────────────────────────────────────────────
 * requireRole(...roles) — returns 403 if user's company role is not in the list.
 * Role hierarchy (highest → lowest): super_admin > admin > employee > guest
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!roles.includes(req.user.companyRole)) {
            auditService.logPermissionDenied(req.user.companyId, req.user.id, `requireRole(${roles.join(', ')})`, 'company', req.user.companyId);
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
function requireDepartmentRole(departmentId, ...roles) {
    return async (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        // If user's company role is super_admin or admin, bypass department checks
        if (req.user.companyRole === 'super_admin' || req.user.companyRole === 'admin') {
            next();
            return;
        }
        const deptRole = req.user.departmentRoles.find((r) => r.departmentId === departmentId);
        if (!deptRole || !roles.includes(deptRole.role)) {
            auditService.logPermissionDenied(req.user.companyId, req.user.id, `requireDepartmentRole(${departmentId}, ${roles.join(', ')})`, 'department', departmentId);
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
function requireObjectRole(objectType, objectId, ...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        // super_admin / admin bypass object-level checks
        if (req.user.companyRole === 'super_admin' || req.user.companyRole === 'admin') {
            next();
            return;
        }
        const objRole = req.user.objectRoles.find((r) => r.objectType === objectType && r.objectId === objectId);
        if (!objRole || !roles.includes(objRole.role)) {
            auditService.logPermissionDenied(req.user.companyId, req.user.id, `requireObjectRole(${objectType}, ${objectId}, ${roles.join(', ')})`, objectType, objectId);
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
function requireSuperAdmin(req, res, next) {
    requireRole('super_admin')(req, res, next);
}
/**
 * ─── Admin or higher ─────────────────────────────────────────────────────────
 * Convenience wrapper — super_admin or admin can proceed.
 */
function requireAdmin(req, res, next) {
    requireRole('super_admin', 'admin')(req, res, next);
}
//# sourceMappingURL=rbac.js.map