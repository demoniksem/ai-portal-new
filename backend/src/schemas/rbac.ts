import { z } from 'zod';

// ===== Enums as zod schemas =====

export const CompanyRoleSchema = z.enum(['super_admin', 'admin', 'employee', 'guest']);
export type CompanyRole = z.infer<typeof CompanyRoleSchema>;

export const DepartmentRoleSchema = z.enum(['department_head', 'member']);
export type DepartmentRole = z.infer<typeof DepartmentRoleSchema>;

export const ObjectRoleSchema = z.enum(['owner', 'editor', 'viewer']);
export type ObjectRole = z.infer<typeof ObjectRoleSchema>;

// ===== User schemas =====

export const registerV2Schema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase and number'),
  fullName: z.string().min(1).max(255).optional(),
  companyId: z.string().uuid('Invalid company ID').optional(), // optional for first user (becomes super_admin)
});

export const loginV2Schema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// ===== Company schemas =====

export const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  ownerEmail: z.string().email('Invalid owner email format'),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().optional(),
});

// ===== Department schemas =====

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  headUserId: z.string().uuid('Invalid user ID').optional(),
});

// ===== Role assignment schemas =====

export const assignCompanyRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: CompanyRoleSchema,
});

export const assignDepartmentRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: DepartmentRoleSchema,
});

export const assignObjectRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  objectType: z.enum(['space', 'board', 'page']),
  objectId: z.string().uuid('Invalid object ID'),
  role: ObjectRoleSchema,
});

// ===== Audit log schemas =====

export const auditLogQuerySchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  actorId: z.string().uuid('Invalid actor ID').optional(),
  action: z.string().optional(),
  objectType: z.string().optional(),
  objectId: z.string().uuid('Invalid object ID').optional(),
  limit: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 50),
  offset: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 0),
  from: z.string().datetime().optional(), // ISO timestamp
  to: z.string().datetime().optional(),
});

// ===== Response types =====

export const userPublicSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export const companyRoleResponseSchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
  role: CompanyRoleSchema,
});

export const departmentRoleResponseSchema = z.object({
  userId: z.string().uuid(),
  departmentId: z.string().uuid(),
  role: DepartmentRoleSchema,
});
