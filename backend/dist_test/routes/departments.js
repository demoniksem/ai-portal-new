'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const logger_1 = require("../config/logger");
const middleware_1 = require("../middleware");
const rbac_1 = require("../schemas/rbac");
const router = (0, express_1.Router)();
function uuid(name) {
    return (req, _res, next) => {
        const val = req.params[name];
        if (val && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
            _res.status(400).json({ error: `${name} must be a valid UUID` });
            return;
        }
        next();
    };
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getUserCompanyId(userId) {
    const r = await config_1.pool.query('SELECT company_id FROM rbac_users WHERE id = $1', [userId]);
    return r.rows[0]?.company_id ?? null;
}
// ─── Departments ───────────────────────────────────────────────────────────────
// GET /api/departments — list all departments for the company
router.get('/', middleware_1.authMiddleware, async (req, res) => {
    const requestId = req.requestId || 'unknown';
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        const result = await config_1.pool.query(`SELECT d.id, d.company_id, d.name, d.head_user_id, d.description, d.created_at, d.updated_at,
              u.name as head_user_name, u.email as head_user_email,
              (SELECT COUNT(*) FROM department_roles WHERE department_id = d.id) as member_count
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.company_id = $1
       ORDER BY d.name`, [companyId]);
        res.json(result.rows);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'GET /departments error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});
// POST /api/departments — create a department
router.post('/', middleware_1.authMiddleware, middleware_1.requireAdmin, async (req, res) => {
    const requestId = req.requestId || 'unknown';
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        const { name, description, headUserId } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        const result = await config_1.pool.query(`INSERT INTO departments (company_id, name, description, head_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, company_id, name, description, head_user_id, created_at, updated_at`, [companyId, name.trim(), description ?? null, headUserId ?? null]);
        logger_1.logger.info({ msg: '[Departments] created', departmentId: result.rows[0].id, companyId, requestId });
        res.status(201).json(result.rows[0]);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'POST /departments error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to create department' });
    }
});
// GET /api/departments/:id — get a single department
router.get('/:id', middleware_1.authMiddleware, uuid('id'), async (req, res) => {
    const requestId = req.requestId || 'unknown';
    const { id } = req.params;
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        const result = await config_1.pool.query(`SELECT d.id, d.company_id, d.name, d.head_user_id, d.description, d.created_at, d.updated_at,
              u.name as head_user_name, u.email as head_user_email,
              (SELECT COUNT(*) FROM department_roles WHERE department_id = d.id) as member_count
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.id = $1 AND d.company_id = $2`, [id, companyId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'GET /departments/:id error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to fetch department' });
    }
});
// PATCH /api/departments/:id — update a department
router.patch('/:id', middleware_1.authMiddleware, middleware_1.requireAdmin, uuid('id'), async (req, res) => {
    const requestId = req.requestId || 'unknown';
    const { id } = req.params;
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        const { name, description, headUserId } = req.body;
        // Verify department belongs to this company
        const existing = await config_1.pool.query('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (existing.rows.length === 0) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }
        const fields = [];
        const values = [];
        let idx = 1;
        if (name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(name.trim());
        }
        if (description !== undefined) {
            fields.push(`description = $${idx++}`);
            values.push(description);
        }
        if (headUserId !== undefined) {
            fields.push(`head_user_id = $${idx++}`);
            values.push(headUserId);
        }
        if (fields.length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }
        values.push(id);
        const result = await config_1.pool.query(`UPDATE departments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
        logger_1.logger.info({ msg: '[Departments] updated', departmentId: id, companyId, requestId });
        res.json(result.rows[0]);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'PATCH /departments/:id error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to update department' });
    }
});
// DELETE /api/departments/:id — delete a department
router.delete('/:id', middleware_1.authMiddleware, middleware_1.requireAdmin, uuid('id'), async (req, res) => {
    const requestId = req.requestId || 'unknown';
    const { id } = req.params;
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        const result = await config_1.pool.query('DELETE FROM departments WHERE id = $1 AND company_id = $2 RETURNING id', [id, companyId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }
        logger_1.logger.info({ msg: '[Departments] deleted', departmentId: id, companyId, requestId });
        res.json({ deleted: true });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'DELETE /departments/:id error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to delete department' });
    }
});
// ─── Department Members ────────────────────────────────────────────────────────
// GET /api/departments/:id/members — list members of a department
router.get('/:id/members', middleware_1.authMiddleware, uuid('id'), async (req, res) => {
    const requestId = req.requestId || 'unknown';
    const { id } = req.params;
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        // Verify department belongs to this company
        const dept = await config_1.pool.query('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (dept.rows.length === 0) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }
        const result = await config_1.pool.query(`SELECT dr.user_id, dr.role, dr.created_at as joined_at,
              u.name as user_name, u.email as user_email
       FROM department_roles dr
       JOIN rbac_users u ON u.id = dr.user_id
       WHERE dr.department_id = $1
       ORDER BY dr.role, u.name`, [id]);
        res.json(result.rows);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'GET /departments/:id/members error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to fetch department members' });
    }
});
// POST /api/departments/:id/members — add a member to a department
router.post('/:id/members', middleware_1.authMiddleware, middleware_1.requireAdmin, uuid('id'), async (req, res) => {
    const requestId = req.requestId || 'unknown';
    const { id } = req.params;
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        // Verify department belongs to this company
        const dept = await config_1.pool.query('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (dept.rows.length === 0) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }
        const { userId, role = 'member' } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId is required' });
            return;
        }
        // Validate role
        const parsed = rbac_1.DepartmentRoleSchema.safeParse(role);
        if (!parsed.success) {
            res.status(400).json({ error: 'role must be department_head or member' });
            return;
        }
        // Verify user belongs to same company
        const userCompany = await config_1.pool.query('SELECT company_id FROM rbac_users WHERE id = $1', [userId]);
        if (userCompany.rows.length === 0 || userCompany.rows[0].company_id !== companyId) {
            res.status(400).json({ error: 'User not found in this company' });
            return;
        }
        const result = await config_1.pool.query(`INSERT INTO department_roles (user_id, department_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, department_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
       RETURNING user_id, department_id, role, created_at`, [userId, id, parsed.data]);
        logger_1.logger.info({ msg: '[Departments] member added', departmentId: id, userId, role: parsed.data, requestId });
        res.status(201).json(result.rows[0]);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'POST /departments/:id/members error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to add department member' });
    }
});
// PATCH /api/departments/:id/members/:userId — update a member's role
router.patch('/:id/members/:userId', middleware_1.authMiddleware, middleware_1.requireAdmin, uuid('id'), uuid('userId'), async (req, res) => {
    const requestId = req.requestId || 'unknown';
    const { id, userId } = req.params;
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        // Verify department belongs to this company
        const dept = await config_1.pool.query('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (dept.rows.length === 0) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }
        const { role } = req.body;
        const parsed = rbac_1.DepartmentRoleSchema.safeParse(role);
        if (!parsed.success) {
            res.status(400).json({ error: 'role must be department_head or member' });
            return;
        }
        const result = await config_1.pool.query(`UPDATE department_roles SET role = $1, updated_at = NOW()
       WHERE department_id = $2 AND user_id = $3
       RETURNING user_id, department_id, role`, [parsed.data, id, userId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Member not found in department' });
            return;
        }
        logger_1.logger.info({ msg: '[Departments] member role updated', departmentId: id, userId, role: parsed.data, requestId });
        res.json(result.rows[0]);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'PATCH /departments/:id/members/:userId error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to update member role' });
    }
});
// DELETE /api/departments/:id/members/:userId — remove a member from a department
router.delete('/:id/members/:userId', middleware_1.authMiddleware, middleware_1.requireAdmin, uuid('id'), uuid('userId'), async (req, res) => {
    const requestId = req.requestId || 'unknown';
    const { id, userId } = req.params;
    try {
        const companyId = await getUserCompanyId(req.user.id);
        if (!companyId) {
            res.status(403).json({ error: 'User has no company' });
            return;
        }
        // Verify department belongs to this company
        const dept = await config_1.pool.query('SELECT id, head_user_id FROM departments WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (dept.rows.length === 0) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }
        // Prevent removing the department head
        if (dept.rows[0].head_user_id === userId) {
            res.status(400).json({ error: 'Cannot remove the department head. Update the head first.' });
            return;
        }
        const result = await config_1.pool.query('DELETE FROM department_roles WHERE department_id = $1 AND user_id = $2 RETURNING user_id', [id, userId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Member not found in department' });
            return;
        }
        logger_1.logger.info({ msg: '[Departments] member removed', departmentId: id, userId, requestId });
        res.json({ removed: true });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'DELETE /departments/:id/members/:userId error', error: e.message, requestId });
        res.status(500).json({ error: 'Failed to remove department member' });
    }
});
exports.default = router;
//# sourceMappingURL=departments.js.map