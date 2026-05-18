'use strict';

import { pool } from '../config';

// ─── Legacy (serial ID) user types ───────────────────────────────────────────
interface LegacyUser {
  id: number;
  email: string;
  username: string | null;
}

interface LegacyUserWithPassword extends LegacyUser {
  password_hash: string;
}

// ─── RBAC user types ─────────────────────────────────────────────────────────
interface RbacUser {
  id: string;
  company_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RbacUserWithPassword extends RbacUser {
  password_hash: string;
}

interface CompanyRoleRow {
  role: 'super_admin' | 'admin' | 'employee' | 'guest';
}

interface DepartmentRoleRow {
  department_id: string;
  role: 'department_head' | 'member';
}

interface ObjectRoleRow {
  object_type: 'space' | 'board' | 'page';
  object_id: string;
  role: 'owner' | 'editor' | 'viewer';
}

interface UserFullProfile {
  id: string;
  companyId: string;
  email: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  companyRole: 'super_admin' | 'admin' | 'employee' | 'guest';
  departmentRoles: DepartmentRoleRow[];
  objectRoles: ObjectRoleRow[];
}

// ─── AI Settings types ────────────────────────────────────────────────────────
interface AISettings {
  provider: string;
  api_key: string | null;
  model: string;
  temperature: any;
  max_tokens: number;
}

interface UpsertAISettingsResult {
  provider: string;
  model: string;
  temperature: any;
  max_tokens: number;
}

// ─── Legacy repository (serial IDs — for backward compat) ─────────────────────
class UsersRepository {
  async findByEmail(email: string): Promise<LegacyUserWithPassword | null> {
    const result = await pool.query<LegacyUserWithPassword>(
      'SELECT id, email, username, password_hash FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findById(id: number): Promise<LegacyUser | null> {
    const result = await pool.query<LegacyUser>(
      'SELECT id, email, username FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data: { email: string; passwordHash: string; username?: string }): Promise<LegacyUser> {
    const result = await pool.query<LegacyUser>(
      'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
      [data.email, data.passwordHash, data.username || null]
    );
    return result.rows[0];
  }

  async getAISettings(userId: number): Promise<AISettings | null> {
    const result = await pool.query<AISettings>(
      'SELECT provider, api_key, model, temperature, max_tokens FROM ai_settings WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async upsertAISettings(data: {
    userId: number;
    provider: string;
    apiKey?: string;
    model: string;
    temperature: number;
    maxTokens: number;
  }): Promise<UpsertAISettingsResult> {
    const result = await pool.query<UpsertAISettingsResult>(
      `INSERT INTO ai_settings (user_id, provider, api_key, model, temperature, max_tokens, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         provider = EXCLUDED.provider,
         api_key = COALESCE(NULLIF(EXCLUDED.api_key, ''), ai_settings.api_key),
         model = EXCLUDED.model,
         temperature = EXCLUDED.temperature,
         max_tokens = EXCLUDED.max_tokens,
         updated_at = NOW()
       RETURNING provider, model, temperature, max_tokens`,
      [data.userId, data.provider, data.apiKey || null, data.model, data.temperature, data.maxTokens]
    );
    return result.rows[0];
  }
}

// ─── RBAC repository (UUID-based users) ────────────────────────────────────────
class RbacUsersRepository {
  /**
   * Find an RBAC user by email within a company.
   */
  async findByEmail(email: string, companyId: string): Promise<RbacUserWithPassword | null> {
    const result = await pool.query<RbacUserWithPassword>(
      `SELECT id, company_id, email, full_name, username, avatar_url,
              is_active, created_at, updated_at, deleted_at, password_hash
       FROM rbac_users
       WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [email, companyId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find an RBAC user by UUID.
   */
  async findById(id: string): Promise<RbacUser | null> {
    const result = await pool.query<RbacUser>(
      `SELECT id, company_id, email, full_name, username, avatar_url,
              is_active, created_at, updated_at, deleted_at
       FROM rbac_users
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new RBAC user with default 'employee' role.
   */
  async create(data: {
    email: string;
    passwordHash: string;
    companyId: string;
    fullName?: string;
    username?: string;
  }): Promise<RbacUser> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert user
      const userResult = await client.query<RbacUser>(
        `INSERT INTO rbac_users (company_id, email, password_hash, full_name, username)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, company_id, email, full_name, username, avatar_url, is_active, created_at, updated_at, deleted_at`,
        [data.companyId, data.email, data.passwordHash, data.fullName || null, data.username || null]
      );
      const user = userResult.rows[0];

      // Assign default 'employee' role
      await client.query(
        `INSERT INTO company_roles (user_id, company_id, role)
         VALUES ($1, $2, 'employee')`,
        [user.id, data.companyId]
      );

      await client.query('COMMIT');
      return user;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's full profile including all role assignments.
   */
  async getFullProfile(userId: string): Promise<UserFullProfile | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    const [companyRoles, deptRoles, objRoles] = await Promise.all([
      pool.query<CompanyRoleRow>(
        `SELECT role FROM company_roles WHERE user_id = $1 AND company_id = $2`,
        [userId, user.company_id]
      ),
      pool.query<DepartmentRoleRow>(
        `SELECT department_id, role FROM department_roles WHERE user_id = $1`,
        [userId]
      ),
      pool.query<ObjectRoleRow>(
        `SELECT object_type, object_id, role FROM object_roles WHERE user_id = $1`,
        [userId]
      ),
    ]);

    // Highest company role (super_admin > admin > employee > guest)
    const rolePriority = { super_admin: 4, admin: 3, employee: 2, guest: 1 };
    const sortedRoles = [...companyRoles.rows].sort(
      (a, b) => rolePriority[b.role] - rolePriority[a.role]
    );

    return {
      id: user.id,
      companyId: user.company_id,
      email: user.email,
      fullName: user.full_name,
      username: user.username,
      avatarUrl: user.avatar_url,
      isActive: user.is_active,
      companyRole: sortedRoles[0]?.role ?? 'guest',
      departmentRoles: deptRoles.rows,
      objectRoles: objRoles.rows,
    };
  }

  /**
   * Get company-level role for a user.
   */
  async getCompanyRole(userId: string, companyId: string): Promise<CompanyRoleRow['role'] | null> {
    const result = await pool.query<CompanyRoleRow>(
      `SELECT role FROM company_roles WHERE user_id = $1 AND company_id = $2`,
      [userId, companyId]
    );
    return result.rows[0]?.role ?? null;
  }

  /**
   * Get department-level role for a user in a department.
   */
  async getDepartmentRole(userId: string, departmentId: string): Promise<DepartmentRoleRow['role'] | null> {
    const result = await pool.query<DepartmentRoleRow>(
      `SELECT role FROM department_roles WHERE user_id = $1 AND department_id = $2`,
      [userId, departmentId]
    );
    return result.rows[0]?.role ?? null;
  }

  /**
   * Get object-level role for a user on a specific object.
   */
  async getObjectRole(
    userId: string,
    objectType: 'space' | 'board' | 'page',
    objectId: string
  ): Promise<ObjectRoleRow['role'] | null> {
    const result = await pool.query<ObjectRoleRow>(
      `SELECT role FROM object_roles
       WHERE user_id = $1 AND object_type = $2 AND object_id = $3`,
      [userId, objectType, objectId]
    );
    return result.rows[0]?.role ?? null;
  }

  /**
   * Check if a user has at least one of the given company roles.
   */
  async hasCompanyRole(userId: string, companyId: string, roles: CompanyRoleRow['role'][]): Promise<boolean> {
    if (roles.length === 0) return true;
    const result = await pool.query(
      `SELECT 1 FROM company_roles
       WHERE user_id = $1 AND company_id = $2 AND role = ANY($3)`,
      [userId, companyId, roles]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export { UsersRepository, RbacUsersRepository };
export type {
  LegacyUser, LegacyUserWithPassword,
  RbacUser, RbacUserWithPassword,
  CompanyRoleRow, DepartmentRoleRow, ObjectRoleRow,
  UserFullProfile, AISettings, UpsertAISettingsResult
};
