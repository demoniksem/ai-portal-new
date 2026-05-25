import { authMiddleware } from './rbac';
import { optionalAuthMiddleware, requireRole, requireDepartmentRole, requireObjectRole, requireSuperAdmin, requireAdmin, requirePermission } from './rbac';
import { validate, querySchemas, validateQuery } from './validation';
import { globalLimiter, authLimiter, aiLimiter } from './rateLimiter';
import { corsMiddleware } from './cors';
import { requestIdMiddleware } from './requestId';
import { requestLoggerMiddleware } from './requestLogger';

export {
  authMiddleware,
  optionalAuthMiddleware,
  validate,
  validateQuery,
  querySchemas,
  globalLimiter,
  authLimiter,
  aiLimiter,
  corsMiddleware,
  requestIdMiddleware,
  requestLoggerMiddleware,
  // RBAC middleware
  requireRole,
  requireDepartmentRole,
  requireObjectRole,
  requireSuperAdmin,
  requireAdmin,
  requirePermission,
};
