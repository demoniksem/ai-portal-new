"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentRoleResponseSchema = exports.companyRoleResponseSchema = exports.userPublicSchema = exports.auditLogQuerySchema = exports.assignObjectRoleSchema = exports.assignDepartmentRoleSchema = exports.assignCompanyRoleSchema = exports.updateDepartmentSchema = exports.createDepartmentSchema = exports.updateCompanySchema = exports.createCompanySchema = exports.loginV2Schema = exports.registerV2Schema = exports.ObjectRoleSchema = exports.DepartmentRoleSchema = exports.CompanyRoleSchema = void 0;
const zod_1 = require("zod");
// ===== Enums as zod schemas =====
exports.CompanyRoleSchema = zod_1.z.enum(['super_admin', 'admin', 'employee', 'guest']);
exports.DepartmentRoleSchema = zod_1.z.enum(['department_head', 'member']);
exports.ObjectRoleSchema = zod_1.z.enum(['owner', 'editor', 'viewer']);
// ===== User schemas =====
exports.registerV2Schema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format').max(255),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase and number'),
    fullName: zod_1.z.string().min(1).max(255).optional(),
    companyId: zod_1.z.string().uuid('Invalid company ID').optional(), // optional for first user (becomes super_admin)
});
exports.loginV2Schema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
// ===== Company schemas =====
exports.createCompanySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    ownerEmail: zod_1.z.string().email('Invalid owner email format'),
});
exports.updateCompanySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    logoUrl: zod_1.z.string().url().optional(),
});
// ===== Department schemas =====
exports.createDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional(),
});
exports.updateDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(1000).optional(),
    headUserId: zod_1.z.string().uuid('Invalid user ID').optional(),
});
// ===== Role assignment schemas =====
exports.assignCompanyRoleSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('Invalid user ID'),
    role: exports.CompanyRoleSchema,
});
exports.assignDepartmentRoleSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('Invalid user ID'),
    role: exports.DepartmentRoleSchema,
});
exports.assignObjectRoleSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('Invalid user ID'),
    objectType: zod_1.z.enum(['space', 'board', 'page']),
    objectId: zod_1.z.string().uuid('Invalid object ID'),
    role: exports.ObjectRoleSchema,
});
// ===== Audit log schemas =====
exports.auditLogQuerySchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid('Invalid company ID'),
    actorId: zod_1.z.string().uuid('Invalid actor ID').optional(),
    action: zod_1.z.string().optional(),
    objectType: zod_1.z.string().optional(),
    objectId: zod_1.z.string().uuid('Invalid object ID').optional(),
    limit: zod_1.z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 50),
    offset: zod_1.z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 0),
    from: zod_1.z.string().datetime().optional(), // ISO timestamp
    to: zod_1.z.string().datetime().optional(),
});
// ===== Response types =====
exports.userPublicSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    fullName: zod_1.z.string().nullable(),
    avatarUrl: zod_1.z.string().nullable(),
    isActive: zod_1.z.boolean(),
    createdAt: zod_1.z.string().datetime(),
});
exports.companyRoleResponseSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    companyId: zod_1.z.string().uuid(),
    role: exports.CompanyRoleSchema,
});
exports.departmentRoleResponseSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    departmentId: zod_1.z.string().uuid(),
    role: exports.DepartmentRoleSchema,
});
//# sourceMappingURL=rbac.js.map