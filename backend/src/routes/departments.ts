'use strict';

import { Router, Request, Response } from 'express';
import { pool } from '../config';
import { logger } from '../config/logger';
import { authMiddleware, requireAdmin } from '../middleware';
import { DepartmentRoleSchema } from '../schemas/rbac';

const router: Router = Router();

type Params = Record<string, string>;

function uuid(name: string) {
  return (req: Request, _res: Response, next: () => void) => {
    const val = (req.params as Params)[name];
    if (val && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
      _res.status(400).json({ error: `${name} must be a valid UUID` });
      return;
    }
    next();
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserCompanyId(userId: string): Promise<string | null> {
  const r = await pool.query('SELECT company_id FROM rbac_users WHERE id = $1', [userId]);
  return r.rows[0]?.company_id ?? null;
}

// ─── Departments ───────────────────────────────────────────────────────────────

// GET /api/departments — list all departments for the company
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    const includeDeleted = req.query.include_deleted === 'true';
    const query = `
      SELECT d.id, d.company_id, d.name, d.head_user_id, d.description, d.deleted_at, d.created_at, d.updated_at,
             u.name as head_user_name, u.email as head_user_email,
             (SELECT COUNT(*) FROM department_roles WHERE department_id = d.id AND user_id NOT IN (
               SELECT user_id FROM department_roles dr2 WHERE dr2.department_id = d.id AND dr2.role = 'department_head'
             )) as member_count
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.company_id = $1${includeDeleted ? '' : ' AND d.deleted_at IS NULL'}
       ORDER BY d.name`;
    const result = await pool.query(query, [companyId]);
    res.json(result.rows);
  } catch (e) {
    logger.error({ msg: 'GET /departments error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// POST /api/departments — create a department
router.post('/', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    const { name, description, headUserId } = req.body as {
      name: string;
      description?: string;
      headUserId?: string;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO departments (company_id, name, description, head_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, company_id, name, description, head_user_id, created_at, updated_at`,
      [companyId, name.trim(), description ?? null, headUserId ?? null]
    );

    logger.info({ msg: '[Departments] created', departmentId: result.rows[0].id, companyId, requestId });
    res.status(201).json(result.rows[0]);
  } catch (e) {
    logger.error({ msg: 'POST /departments error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// GET /api/departments/:id — get a single department
router.get('/:id', authMiddleware, uuid('id'), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  const { id } = req.params as Params;
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    const result = await pool.query(
      `SELECT d.id, d.company_id, d.name, d.head_user_id, d.description, d.created_at, d.updated_at,
              u.name as head_user_name, u.email as head_user_email,
              (SELECT COUNT(*) FROM department_roles WHERE department_id = d.id) as member_count
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.id = $1 AND d.company_id = $2`,
      [id, companyId]
    );

    if (result.rows.length === 0) { res.status(404).json({ error: 'Department not found' }); return; }
    res.json(result.rows[0]);
  } catch (e) {
    logger.error({ msg: 'GET /departments/:id error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// PATCH /api/departments/:id — update a department
router.patch('/:id', authMiddleware, requireAdmin, uuid('id'), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  const { id } = req.params as Params;
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    const { name, description, headUserId } = req.body as {
      name?: string;
      description?: string;
      headUserId?: string | null;
    };

    // Verify department belongs to this company
    const existing = await pool.query(
      'SELECT id FROM departments WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    if (existing.rows.length === 0) { res.status(404).json({ error: 'Department not found' }); return; }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (headUserId !== undefined) { fields.push(`head_user_id = $${idx++}`); values.push(headUserId); }

    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    values.push(id);
    const result = await pool.query(
      `UPDATE departments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    logger.info({ msg: '[Departments] updated', departmentId: id, companyId, requestId });
    res.json(result.rows[0]);
  } catch (e) {
    logger.error({ msg: 'PATCH /departments/:id error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// DELETE /api/departments/:id — soft-delete a department
router.delete('/:id', authMiddleware, requireAdmin, uuid('id'), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  const { id } = req.params as Params;
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    const result = await pool.query(
      'UPDATE departments SET deleted_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING id',
      [id, companyId]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Department not found' }); return; }

    logger.info({ msg: '[Departments] soft-deleted', departmentId: id, companyId, requestId });
    res.json({ deleted: true });
  } catch (e) {
    logger.error({ msg: 'DELETE /departments/:id error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ─── Department Members ────────────────────────────────────────────────────────

// GET /api/departments/:id/members — list members of a department
router.get('/:id/members', authMiddleware, uuid('id'), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  const { id } = req.params as Params;
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    // Verify department belongs to this company
    const dept = await pool.query(
      'SELECT id FROM departments WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    if (dept.rows.length === 0) { res.status(404).json({ error: 'Department not found' }); return; }

    const result = await pool.query(
      `SELECT dr.user_id, dr.role, dr.created_at as joined_at,
              u.name as user_name, u.email as user_email
       FROM department_roles dr
       JOIN rbac_users u ON u.id = dr.user_id
       WHERE dr.department_id = $1
       ORDER BY dr.role, u.name`,
      [id]
    );
    res.json(result.rows);
  } catch (e) {
    logger.error({ msg: 'GET /departments/:id/members error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to fetch department members' });
  }
});

// POST /api/departments/:id/members — add a member to a department
router.post('/:id/members', authMiddleware, requireAdmin, uuid('id'), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  const { id } = req.params as Params;
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    // Verify department belongs to this company
    const dept = await pool.query(
      'SELECT id FROM departments WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    if (dept.rows.length === 0) { res.status(404).json({ error: 'Department not found' }); return; }

    const { userId, role = 'member' } = req.body as { userId: string; role?: string };

    if (!userId) { res.status(400).json({ error: 'userId is required' }); return; }

    // Validate role
    const parsed = DepartmentRoleSchema.safeParse(role);
    if (!parsed.success) { res.status(400).json({ error: 'role must be department_head or member' }); return; }

    // Verify user belongs to same company
    const userCompany = await pool.query(
      'SELECT company_id FROM rbac_users WHERE id = $1',
      [userId]
    );
    if (userCompany.rows.length === 0 || userCompany.rows[0].company_id !== companyId) {
      res.status(400).json({ error: 'User not found in this company' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO department_roles (user_id, department_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, department_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
       RETURNING user_id, department_id, role, created_at`,
      [userId, id, parsed.data]
    );

    logger.info({ msg: '[Departments] member added', departmentId: id, userId, role: parsed.data, requestId });
    res.status(201).json(result.rows[0]);
  } catch (e) {
    logger.error({ msg: 'POST /departments/:id/members error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to add department member' });
  }
});

// PATCH /api/departments/:id/members/:userId — update a member's role
router.patch('/:id/members/:userId', authMiddleware, requireAdmin, uuid('id'), uuid('userId'), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  const { id, userId } = req.params as Params;
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    // Verify department belongs to this company
    const dept = await pool.query(
      'SELECT id FROM departments WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    if (dept.rows.length === 0) { res.status(404).json({ error: 'Department not found' }); return; }

    const { role } = req.body as { role: string };
    const parsed = DepartmentRoleSchema.safeParse(role);
    if (!parsed.success) { res.status(400).json({ error: 'role must be department_head or member' }); return; }

    const result = await pool.query(
      `UPDATE department_roles SET role = $1, updated_at = NOW()
       WHERE department_id = $2 AND user_id = $3
       RETURNING user_id, department_id, role`,
      [parsed.data, id, userId]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Member not found in department' }); return; }

    logger.info({ msg: '[Departments] member role updated', departmentId: id, userId, role: parsed.data, requestId });
    res.json(result.rows[0]);
  } catch (e) {
    logger.error({ msg: 'PATCH /departments/:id/members/:userId error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/departments/:id/members/:userId — remove a member from a department
router.delete('/:id/members/:userId', authMiddleware, requireAdmin, uuid('id'), uuid('userId'), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  const { id, userId } = req.params as Params;
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    // Verify department belongs to this company
    const dept = await pool.query(
      'SELECT id, head_user_id FROM departments WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    if (dept.rows.length === 0) { res.status(404).json({ error: 'Department not found' }); return; }

    // Prevent removing the department head
    if (dept.rows[0].head_user_id === userId) {
      res.status(400).json({ error: 'Cannot remove the department head. Update the head first.' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM department_roles WHERE department_id = $1 AND user_id = $2 RETURNING user_id',
      [id, userId]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Member not found in department' }); return; }

    logger.info({ msg: '[Departments] member removed', departmentId: id, userId, requestId });
    res.json({ removed: true });
  } catch (e) {
    logger.error({ msg: 'DELETE /departments/:id/members/:userId error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to remove department member' });
  }
});

// GET /api/departments/org-tree — full org structure with members
router.get('/org-tree', authMiddleware, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    if (!companyId) { res.status(403).json({ error: 'User has no company' }); return; }

    // Get all active departments
    const depts = await pool.query(
      `SELECT d.id, d.name, d.description, d.head_user_id, u.name as head_user_name, u.email as head_user_email
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.company_id = $1 AND d.deleted_at IS NULL
       ORDER BY d.name`,
      [companyId]
    );

    if (depts.rows.length === 0) { res.json([]); return; }

    const deptIds = depts.rows.map((d: any) => d.id);

    // Get all department roles for these departments
    const roles = await pool.query(
      `SELECT dr.department_id, dr.user_id, dr.role, u.name, u.email
       FROM department_roles dr
       JOIN rbac_users u ON u.id = dr.user_id
       WHERE dr.department_id = ANY($1)
       ORDER BY dr.role, u.name`,
      [deptIds]
    );

    // Get all company members (for members not yet in any department)
    const allUsers = await pool.query(
      `SELECT id, name, email FROM rbac_users WHERE company_id = $1 ORDER BY name`,
      [companyId]
    );

    const roleMap: Record<string, any[]> = {};
    for (const r of roles.rows) {
      if (!roleMap[r.department_id]) roleMap[r.department_id] = [];
      roleMap[r.department_id].push({ userId: r.user_id, name: r.name, email: r.email, role: r.role });
    }

    const result = depts.rows.map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      head: d.head_user_id ? { userId: d.head_user_id, name: d.head_user_name, email: d.head_user_email } : null,
      members: (roleMap[d.id] || []).filter((m: any) => m.role !== 'department_head'),
    }));

    res.json(result);
  } catch (e) {
    logger.error({ msg: 'GET /departments/org-tree error', error: (e as Error).message, requestId });
    res.status(500).json({ error: 'Failed to load org tree' });
  }
});

export default router;
