'use strict';

import { pool } from '../config';
import { logger } from '../config/logger';

export interface DepartmentRow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  head_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DepartmentWithHead extends DepartmentRow {
  head_user_name?: string | null;
  member_count?: number;
}

export interface CreateDepartmentInput {
  name: string;
  description?: string;
  headUserId?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
  headUserId?: string | null;
}

export class DepartmentsService {
  /**
   * List all departments for a company.
   */
  async listByCompany(companyId: string): Promise<DepartmentWithHead[]> {
    const result = await pool.query<DepartmentWithHead>(
      `SELECT d.*,
              u.full_name as head_user_name,
              (SELECT COUNT(*) FROM department_roles dr WHERE dr.department_id = d.id)::int as member_count
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.company_id = $1
       ORDER BY d.created_at ASC`,
      [companyId]
    );
    return result.rows;
  }

  /**
   * Get a single department by ID.
   */
  async getById(departmentId: string, companyId: string): Promise<DepartmentWithHead | null> {
    const result = await pool.query<DepartmentWithHead>(
      `SELECT d.*,
              u.full_name as head_user_name,
              (SELECT COUNT(*) FROM department_roles dr WHERE dr.department_id = d.id)::int as member_count
       FROM departments d
       LEFT JOIN rbac_users u ON u.id = d.head_user_id
       WHERE d.id = $1 AND d.company_id = $2`,
      [departmentId, companyId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Create a new department.
   */
  async create(companyId: string, data: CreateDepartmentInput): Promise<DepartmentRow> {
    const result = await pool.query<DepartmentRow>(
      `INSERT INTO departments (company_id, name, description, head_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [companyId, data.name, data.description ?? null, data.headUserId ?? null]
    );
    logger.info({ msg: '[Departments] created', departmentId: result.rows[0].id, companyId });
    return result.rows[0];
  }

  /**
   * Update a department.
   */
  async update(departmentId: string, companyId: string, data: UpdateDepartmentInput): Promise<DepartmentRow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
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

    const result = await pool.query<DepartmentRow>(
      `UPDATE departments SET ${fields.join(', ')}
       WHERE id = $${idx++} AND company_id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    logger.info({ msg: '[Departments] updated', departmentId, companyId });
    return result.rows[0];
  }

  /**
   * Delete a department.
   */
  async delete(departmentId: string, companyId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM departments WHERE id = $1 AND company_id = $2 RETURNING id',
      [departmentId, companyId]
    );
    if (result.rows.length > 0) {
      logger.info({ msg: '[Departments] deleted', departmentId, companyId });
      return true;
    }
    return false;
  }

  /**
   * List members of a department.
   */
  async listMembers(departmentId: string, companyId: string): Promise<unknown[]> {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.avatar_url, dr.role, dr.created_at as joined_at
       FROM department_roles dr
       JOIN rbac_users u ON u.id = dr.user_id
       JOIN departments d ON d.id = dr.department_id
       WHERE dr.department_id = $1 AND d.company_id = $2
       ORDER BY dr.created_at ASC`,
      [departmentId, companyId]
    );
    return result.rows;
  }

  /**
   * Add a member to a department (or update their role).
   */
  async addMember(departmentId: string, companyId: string, userId: string, role: 'department_head' | 'member' = 'member'): Promise<unknown> {
    // Verify department belongs to company
    const dept = await pool.query('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [departmentId, companyId]);
    if (dept.rows.length === 0) return null;

    const result = await pool.query(
      `INSERT INTO department_roles (user_id, department_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, department_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
       RETURNING *`,
      [userId, departmentId, role]
    );
    logger.info({ msg: '[Departments] member added', departmentId, userId, role });
    return result.rows[0];
  }

  /**
   * Remove a member from a department.
   */
  async removeMember(departmentId: string, companyId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM department_roles dr
       USING departments d
       WHERE dr.department_id = d.id AND dr.user_id = $1 AND dr.department_id = $2 AND d.company_id = $3
       RETURNING dr.id`,
      [userId, departmentId, companyId]
    );
    return result.rows.length > 0;
  }

  /**
   * Update a member's role in a department.
   */
  async updateMemberRole(departmentId: string, companyId: string, userId: string, role: 'department_head' | 'member'): Promise<unknown | null> {
    const result = await pool.query(
      `UPDATE department_roles dr SET role = $1, updated_at = NOW()
       FROM departments d
       WHERE dr.department_id = d.id AND dr.user_id = $2 AND dr.department_id = $3 AND d.company_id = $4
       RETURNING dr.*`,
      [role, userId, departmentId, companyId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }
}
