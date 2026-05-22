import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuditService } from '../services/auditService';
import { DepartmentsService } from '../services/departmentsService';
import { authMiddleware, requireSuperAdmin, requireAdmin } from '../middleware';
import { pool } from '../config';
import { logger } from '../config/logger';

const router: Router = Router();
const auditService = new AuditService();
const departmentsService = new DepartmentsService();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getCompanyId(userId: string): Promise<string | null> {
  const r = await pool.query('SELECT company_id FROM rbac_users WHERE id = $1', [userId]);
  return r.rows[0]?.company_id ?? null;
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const [usersResult, deptsResult, boardsResult, cardsResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM rbac_users WHERE company_id = $1 AND deleted_at IS NULL', [companyId]),
      pool.query('SELECT COUNT(*) FROM departments WHERE company_id = $1 AND deleted_at IS NULL', [companyId]),
      // boards/cards are not company-scoped in this single-tenant schema — count all
      pool.query('SELECT COUNT(*) FROM boards'),
      pool.query('SELECT COUNT(*) FROM cards'),
    ]);
    return res.json({
      users: parseInt(usersResult.rows[0].count, 10),
      departments: parseInt(deptsResult.rows[0].count, 10),
      boards: parseInt(boardsResult.rows[0].count, 10),
      cards: parseInt(cardsResult.rows[0].count, 10),
    });
  } catch (e) {
    logger.error({ msg: '[Admin] stats error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, COALESCE(cr.role::text, 'member') AS company_role,
              u.is_active, u.created_at
       FROM rbac_users u
       LEFT JOIN company_roles cr ON cr.user_id = u.id AND cr.company_id = u.company_id
       WHERE u.company_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC`,
      [companyId]
    );
    return res.json(result.rows);
  } catch (e) {
    logger.error({ msg: '[Admin] users list error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────
router.post('/users', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { email, password, fullName, role = 'employee' } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const existing = await pool.query('SELECT id FROM rbac_users WHERE email = $1 AND deleted_at IS NULL', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO rbac_users (email, password_hash, full_name, company_id, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id, email, full_name, is_active, created_at`,
      [email.toLowerCase(), passwordHash, fullName || null, companyId]
    );
    const newUser = result.rows[0];
    await pool.query(
      `INSERT INTO company_roles (user_id, company_id, role) VALUES ($1, $2, $3)`,
      [newUser.id, companyId, role]
    );

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'user.create', objectType: 'user', objectId: newUser.id,
      newValue: { email, role },
    });

    return res.status(201).json({ ...newUser, company_role: role });
  } catch (e) {
    logger.error({ msg: '[Admin] create user error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// ─── PATCH /api/admin/users/:userId ──────────────────────────────────────────
router.patch('/users/:userId', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { userId } = req.params;
    const { email, fullName, role, password, isActive } = req.body;

    const userCheck = await pool.query('SELECT id FROM rbac_users WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [userId, companyId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (email !== undefined) {
      const dup = await pool.query('SELECT id FROM rbac_users WHERE email = $1 AND id != $2 AND deleted_at IS NULL', [email.toLowerCase(), userId]);
      if (dup.rows.length > 0) return res.status(409).json({ error: 'Email already in use' });
      updates.push(`email = $${idx++}`);
      values.push(email.toLowerCase());
    }
    if (fullName !== undefined) { updates.push(`full_name = $${idx++}`); values.push(fullName || null); }
    if (isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(isActive); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    // company_role lives in the company_roles table, not on rbac_users — upsert it.
    if (role !== undefined) {
      const upd = await pool.query(
        'UPDATE company_roles SET role = $1, updated_at = now() WHERE user_id = $2 AND company_id = $3',
        [role, userId, companyId]
      );
      if (upd.rowCount === 0) {
        await pool.query('INSERT INTO company_roles (user_id, company_id, role) VALUES ($1, $2, $3)', [userId, companyId, role]);
      }
    }

    if (updates.length === 0 && role === undefined) return res.status(400).json({ error: 'No fields to update' });

    if (updates.length > 0) {
      values.push(userId);
      await pool.query(`UPDATE rbac_users SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx}`, values);
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, COALESCE(cr.role::text, 'member') AS company_role,
              u.is_active, u.created_at
       FROM rbac_users u
       LEFT JOIN company_roles cr ON cr.user_id = u.id AND cr.company_id = u.company_id
       WHERE u.id = $1`,
      [userId]
    );

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'user.update', objectType: 'user', objectId: userId,
      newValue: { email, fullName, role, isActive },
    });

    return res.json(result.rows[0]);
  } catch (e) {
    logger.error({ msg: '[Admin] update user error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// ─── DELETE /api/admin/users/:userId ─────────────────────────────────────────
router.delete('/users/:userId', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { userId } = req.params;
    if (userId === req.user!.id) return res.status(400).json({ error: 'Cannot delete yourself' });

    const result = await pool.query(
      'UPDATE rbac_users SET deleted_at = now() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING id',
      [userId, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'user.delete', objectType: 'user', objectId: userId,
    });

    return res.json({ message: 'User deleted' });
  } catch (e) {
    logger.error({ msg: '[Admin] delete user error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── GET /api/admin/departments ──────────────────────────────────────────────
router.get('/departments', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const result = await pool.query(
      `SELECT d.id, d.name, d.description, d.created_at,
              (SELECT COUNT(*) FROM department_roles dm JOIN rbac_users u ON dm.user_id = u.id WHERE u.company_id = $1 AND u.deleted_at IS NULL AND dm.department_id = d.id) as member_count
       FROM departments d WHERE d.company_id = $1 AND d.deleted_at IS NULL ORDER BY d.created_at DESC`,
      [companyId]
    );
    return res.json(result.rows);
  } catch (e) {
    logger.error({ msg: '[Admin] departments list error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// ─── POST /api/admin/departments ─────────────────────────────────────────────
router.post('/departments', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await departmentsService.create(companyId, { name, description: description || null });

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'department.create', objectType: 'department', objectId: result.id,
      newValue: { name, description },
    });

    return res.status(201).json(result);
  } catch (e) {
    logger.error({ msg: '[Admin] create department error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to create department' });
  }
});

// ─── PATCH /api/admin/departments/:deptId ────────────────────────────────────
router.patch('/departments/:deptId', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { deptId } = req.params;
    const { name, description } = req.body;

    const existing = await pool.query('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [deptId, companyId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Department not found' });

    const result = await departmentsService.update(deptId, companyId, { name, description: description ?? undefined });

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'department.update', objectType: 'department', objectId: deptId,
      newValue: { name, description },
    });

    return res.json(result);
  } catch (e) {
    logger.error({ msg: '[Admin] update department error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to update department' });
  }
});

// ─── DELETE /api/admin/departments/:deptId ───────────────────────────────────
router.delete('/departments/:deptId', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { deptId } = req.params;
    const result = await departmentsService.delete(deptId, companyId);
    if (!result) return res.status(404).json({ error: 'Department not found' });

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'department.delete', objectType: 'department', objectId: deptId,
    });

    return res.json({ message: 'Department deleted' });
  } catch (e) {
    logger.error({ msg: '[Admin] delete department error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ─── GET /api/admin/departments/:deptId/members ───────────────────────────────
router.get('/departments/:deptId/members', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { deptId } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, dm.role::text as department_role
       FROM department_roles dm
       JOIN rbac_users u ON dm.user_id = u.id
       WHERE dm.department_id = $1 AND u.company_id = $2 AND u.deleted_at IS NULL`,
      [deptId, companyId]
    );
    return res.json(result.rows);
  } catch (e) {
    logger.error({ msg: '[Admin] department members error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ─── POST /api/admin/departments/:deptId/members/:userId ─────────────────────
router.post('/departments/:deptId/members/:userId', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { deptId, userId } = req.params;
    const { role = 'member' } = req.body;

    const userCheck = await pool.query('SELECT id FROM rbac_users WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [userId, companyId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const upd = await pool.query(
      'UPDATE department_roles SET role = $3, updated_at = now() WHERE department_id = $1 AND user_id = $2',
      [deptId, userId, role]
    );
    if (upd.rowCount === 0) {
      await pool.query('INSERT INTO department_roles (department_id, user_id, role) VALUES ($1, $2, $3)', [deptId, userId, role]);
    }

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'department.member_add', objectType: 'department_member', objectId: `${deptId}:${userId}`,
      newValue: { deptId, userId, role },
    });

    return res.status(201).json({ departmentId: deptId, userId, role });
  } catch (e) {
    logger.error({ msg: '[Admin] add member error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to add member' });
  }
});

// ─── DELETE /api/admin/departments/:deptId/members/:userId ───────────────────
router.delete('/departments/:deptId/members/:userId', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { deptId, userId } = req.params;
    await pool.query('DELETE FROM department_roles WHERE department_id = $1 AND user_id = $2', [deptId, userId]);

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'department.member_remove', objectType: 'department_member', objectId: `${deptId}:${userId}`,
    });

    return res.json({ message: 'Member removed' });
  } catch (e) {
    logger.error({ msg: '[Admin] remove member error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ─── PATCH /api/admin/departments/:deptId/members/:userId ────────────────────
router.patch('/departments/:deptId/members/:userId', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { deptId, userId } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });

    const result = await pool.query(
      `UPDATE department_roles SET role = $1, updated_at = now() WHERE department_id = $2 AND user_id = $3 RETURNING department_id, user_id, role::text AS role`,
      [role, deptId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'department.member_update', objectType: 'department_member', objectId: `${deptId}:${userId}`,
      newValue: { role },
    });

    return res.json(result.rows[0]);
  } catch (e) {
    logger.error({ msg: '[Admin] update member error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to update member' });
  }
});

// ─── GET /api/admin/roles ─────────────────────────────────────────────────────
router.get('/roles', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, COALESCE(cr.role::text, 'member') AS company_role, u.is_active,
              d.name as department_name, dr.role::text as department_role
       FROM rbac_users u
       LEFT JOIN company_roles cr ON cr.user_id = u.id AND cr.company_id = u.company_id
       LEFT JOIN department_roles dr ON dr.user_id = u.id
       LEFT JOIN departments d ON d.id = dr.department_id
       WHERE u.company_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.email`,
      [companyId]
    );
    return res.json(result.rows);
  } catch (e) {
    logger.error({ msg: '[Admin] roles error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// ─── PATCH /api/admin/roles/:userId/company ──────────────────────────────────
router.patch('/roles/:userId/company', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });

    const userCheck = await pool.query('SELECT id, email, full_name FROM rbac_users WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [userId, companyId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const upd = await pool.query('UPDATE company_roles SET role = $1, updated_at = now() WHERE user_id = $2 AND company_id = $3', [role, userId, companyId]);
    if (upd.rowCount === 0) {
      await pool.query('INSERT INTO company_roles (user_id, company_id, role) VALUES ($1, $2, $3)', [userId, companyId, role]);
    }
    const result = { rows: [{ ...userCheck.rows[0], company_role: role }] };

    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'user.role_change', objectType: 'user', objectId: userId,
      newValue: { companyRole: role },
    });

    return res.json(result.rows[0]);
  } catch (e) {
    logger.error({ msg: '[Admin] update company role error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to update role' });
  }
});

// ─── GET /api/admin/brand ─────────────────────────────────────────────────────
router.get('/brand', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const result = await pool.query(
      `SELECT id, company_id, company_name, logo_url, primary_color, accent_color, created_at, updated_at
       FROM company_settings WHERE company_id = $1`,
      [companyId]
    );
    if (result.rows.length === 0) {
      return res.json({ companyName: '', logoUrl: '', primaryColor: '#6366f1', accentColor: '#818cf8' });
    }
    const r = result.rows[0];
    return res.json({
      id: r.id,
      companyName: r.company_name,
      logoUrl: r.logo_url,
      primaryColor: r.primary_color,
      accentColor: r.accent_color,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (e) {
    logger.error({ msg: '[Admin] brand GET error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to fetch brand settings' });
  }
});

// ─── PUT /api/admin/brand ─────────────────────────────────────────────────────
router.put('/brand', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const { companyName, logoUrl, primaryColor, accentColor } = req.body;

    const result = await pool.query(
      `INSERT INTO company_settings (company_id, company_name, logo_url, primary_color, accent_color, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (company_id) DO UPDATE SET
         company_name = COALESCE(NULLIF($2, ''), company_settings.company_name),
         logo_url = $3,
         primary_color = COALESCE(NULLIF($4, ''), company_settings.primary_color),
         accent_color = COALESCE(NULLIF($5, ''), company_settings.accent_color),
         updated_at = NOW()
       RETURNING id, company_name, logo_url, primary_color, accent_color, updated_at`,
      [companyId, companyName || null, logoUrl || null, primaryColor || null, accentColor || null]
    );

    const r = result.rows[0];
    await auditService.log({
      companyId, actorId: req.user!.id,
      action: 'brand.update', objectType: 'company_settings', objectId: r.id,
      newValue: { companyName, logoUrl, primaryColor, accentColor },
    });

    return res.json({
      id: r.id,
      companyName: r.company_name,
      logoUrl: r.logo_url,
      primaryColor: r.primary_color,
      accentColor: r.accent_color,
      updatedAt: r.updated_at,
    });
  } catch (e) {
    logger.error({ msg: '[Admin] brand PUT error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to update brand settings' });
  }
});

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────
router.get('/audit-log', authMiddleware, requireSuperAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  try {
    const { actorId, action, objectType, objectId, limit = '100', offset = '0' } = req.query as Record<string, string>;
    const entries = await auditService.query({
      companyId,
      actorId,
      action,
      objectType,
      objectId,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    return res.json({ entries });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/ai-config ────────────────────────────────────────────────
router.get('/ai-config', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const requestId = req.requestId || 'unknown';
  try {
    const result = await pool.query(
      `SELECT id, company_id, provider, api_key, model, temperature, max_tokens,
              api_base_url, enabled, created_at, updated_at
       FROM company_ai_config WHERE company_id = $1`,
      [companyId]
    );
    if (result.rows.length === 0) {
      return res.json({ provider: 'openrouter', model: 'qwen/qwen3.6-plus:free', temperature: 0.7, maxTokens: 4000, apiBaseUrl: null, enabled: true, hasApiKey: false });
    }
    const row = result.rows[0];
    return res.json({
      id: row.id, provider: row.provider, hasApiKey: !!(row.api_key), model: row.model,
      temperature: parseFloat(row.temperature), maxTokens: row.max_tokens,
      apiBaseUrl: row.api_base_url, enabled: row.enabled,
      createdAt: row.created_at, updatedAt: row.updated_at,
    });
  } catch (e) {
    logger.error({ msg: '[Admin] ai-config GET error', error: (e as Error).message, companyId, requestId });
    return res.status(500).json({ error: 'Failed to fetch AI config' });
  }
});

export default router;
