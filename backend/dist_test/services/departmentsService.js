'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentsService = void 0;
const config_1 = require("../config");
const logger_1 = require("../config/logger");
class DepartmentsService {
    /**
     * List all departments for a company.
     */
    async listByCompany(companyId) {
        const result = await config_1.pool.query(`SELECT d.*,
              u.full_name as head_user_name,
              (SELECT COUNT(*) FROM department_roles dr WHERE dr.department_id = d.id)::int as member_count
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.company_id = $1
       ORDER BY d.created_at ASC`, [companyId]);
        return result.rows;
    }
    /**
     * Get a single department by ID.
     */
    async getById(departmentId, companyId) {
        const result = await config_1.pool.query(`SELECT d.*,
              u.full_name as head_user_name,
              (SELECT COUNT(*) FROM department_roles dr WHERE dr.department_id = d.id)::int as member_count
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.id = $1 AND d.company_id = $2`, [departmentId, companyId]);
        return result.rows[0] ?? null;
    }
    /**
     * Create a new department.
     */
    async create(companyId, data) {
        const result = await config_1.pool.query(`INSERT INTO departments (company_id, name, description, head_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [companyId, data.name, data.description ?? null, data.headUserId ?? null]);
        logger_1.logger.info({ msg: '[Departments] created', departmentId: result.rows[0].id, companyId });
        return result.rows[0];
    }
    /**
     * Update a department.
     */
    async update(departmentId, companyId, data) {
        const fields = [];
        const values = [];
        let idx = 1;
        if (data.name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(data.name);
        }
        if (data.description !== undefined) {
            fields.push(`description = $${idx++}`);
            values.push(data.description);
        }
        if (data.headUserId !== undefined) {
            fields.push(`head_user_id = $${idx++}`);
            values.push(data.headUserId);
        }
        if (fields.length === 0) {
            return this.getById(departmentId, companyId);
        }
        fields.push(`updated_at = NOW()`);
        values.push(departmentId, companyId);
        const result = await config_1.pool.query(`UPDATE departments SET ${fields.join(', ')}
       WHERE id = $${idx++} AND company_id = $${idx}
       RETURNING *`, values);
        if (result.rows.length === 0)
            return null;
        logger_1.logger.info({ msg: '[Departments] updated', departmentId, companyId });
        return result.rows[0];
    }
    /**
     * Delete a department.
     */
    async delete(departmentId, companyId) {
        const result = await config_1.pool.query('DELETE FROM departments WHERE id = $1 AND company_id = $2 RETURNING id', [departmentId, companyId]);
        if (result.rows.length > 0) {
            logger_1.logger.info({ msg: '[Departments] deleted', departmentId, companyId });
            return true;
        }
        return false;
    }
    /**
     * List members of a department.
     */
    async listMembers(departmentId, companyId) {
        const result = await config_1.pool.query(`SELECT u.id, u.email, u.full_name, u.avatar_url, dr.role, dr.created_at as joined_at
       FROM department_roles dr
       JOIN rbac_users u ON u.id = dr.user_id
       JOIN departments d ON d.id = dr.department_id
       WHERE dr.department_id = $1 AND d.company_id = $2
       ORDER BY dr.created_at ASC`, [departmentId, companyId]);
        return result.rows;
    }
    /**
     * Add a member to a department (or update their role).
     */
    async addMember(departmentId, companyId, userId, role = 'member') {
        // Verify department belongs to company
        const dept = await config_1.pool.query('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [departmentId, companyId]);
        if (dept.rows.length === 0)
            return null;
        const result = await config_1.pool.query(`INSERT INTO department_roles (user_id, department_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, department_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
       RETURNING *`, [userId, departmentId, role]);
        logger_1.logger.info({ msg: '[Departments] member added', departmentId, userId, role });
        return result.rows[0];
    }
    /**
     * Remove a member from a department.
     */
    async removeMember(departmentId, companyId, userId) {
        const result = await config_1.pool.query(`DELETE FROM department_roles dr
       USING departments d
       WHERE dr.department_id = d.id AND dr.user_id = $1 AND dr.department_id = $2 AND d.company_id = $3
       RETURNING dr.id`, [userId, departmentId, companyId]);
        return result.rows.length > 0;
    }
    /**
     * Update a member's role in a department.
     */
    async updateMemberRole(departmentId, companyId, userId, role) {
        const result = await config_1.pool.query(`UPDATE department_roles dr SET role = $1, updated_at = NOW()
       FROM departments d
       WHERE dr.department_id = d.id AND dr.user_id = $2 AND dr.department_id = $3 AND d.company_id = $4
       RETURNING dr.*`, [role, userId, departmentId, companyId]);
        if (result.rows.length === 0)
            return null;
        return result.rows[0];
    }
}
exports.DepartmentsService = DepartmentsService;
//# sourceMappingURL=departmentsService.js.map