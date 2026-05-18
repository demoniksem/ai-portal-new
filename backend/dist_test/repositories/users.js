'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacUsersRepository = exports.UsersRepository = void 0;
const config_1 = require("../config");
// ─── Legacy repository (serial IDs — for backward compat) ─────────────────────
class UsersRepository {
    async findByEmail(email) {
        const result = await config_1.pool.query('SELECT id, email, username, password_hash FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    }
    async findById(id) {
        const result = await config_1.pool.query('SELECT id, email, username FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    async create(data) {
        const result = await config_1.pool.query('INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username', [data.email, data.passwordHash, data.username || null]);
        return result.rows[0];
    }
    async getAISettings(userId) {
        const result = await config_1.pool.query('SELECT provider, api_key, model, temperature, max_tokens FROM ai_settings WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
    }
    async upsertAISettings(data) {
        const result = await config_1.pool.query(`INSERT INTO ai_settings (user_id, provider, api_key, model, temperature, max_tokens, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         provider = EXCLUDED.provider,
         api_key = COALESCE(NULLIF(EXCLUDED.api_key, ''), ai_settings.api_key),
         model = EXCLUDED.model,
         temperature = EXCLUDED.temperature,
         max_tokens = EXCLUDED.max_tokens,
         updated_at = NOW()
       RETURNING provider, model, temperature, max_tokens`, [data.userId, data.provider, data.apiKey || null, data.model, data.temperature, data.maxTokens]);
        return result.rows[0];
    }
}
exports.UsersRepository = UsersRepository;
// ─── RBAC repository (UUID-based users) ────────────────────────────────────────
class RbacUsersRepository {
    /**
     * Find an RBAC user by email within a company.
     */
    async findByEmail(email, companyId) {
        const result = await config_1.pool.query(`SELECT id, company_id, email, full_name, username, avatar_url,
              is_active, created_at, updated_at, deleted_at, password_hash
       FROM rbac_users
       WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL`, [email, companyId]);
        return result.rows[0] || null;
    }
    /**
     * Find an RBAC user by UUID.
     */
    async findById(id) {
        const result = await config_1.pool.query(`SELECT id, company_id, email, full_name, username, avatar_url,
              is_active, created_at, updated_at, deleted_at
       FROM rbac_users
       WHERE id = $1 AND deleted_at IS NULL`, [id]);
        return result.rows[0] || null;
    }
    /**
     * Create a new RBAC user with default 'employee' role.
     */
    async create(data) {
        const client = await config_1.pool.connect();
        try {
            await client.query('BEGIN');
            // Insert user
            const userResult = await client.query(`INSERT INTO rbac_users (company_id, email, password_hash, full_name, username)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, company_id, email, full_name, username, avatar_url, is_active, created_at, updated_at, deleted_at`, [data.companyId, data.email, data.passwordHash, data.fullName || null, data.username || null]);
            const user = userResult.rows[0];
            // Assign default 'employee' role
            await client.query(`INSERT INTO company_roles (user_id, company_id, role)
         VALUES ($1, $2, 'employee')`, [user.id, data.companyId]);
            await client.query('COMMIT');
            return user;
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get user's full profile including all role assignments.
     */
    async getFullProfile(userId) {
        const user = await this.findById(userId);
        if (!user)
            return null;
        const [companyRoles, deptRoles, objRoles] = await Promise.all([
            config_1.pool.query(`SELECT role FROM company_roles WHERE user_id = $1 AND company_id = $2`, [userId, user.company_id]),
            config_1.pool.query(`SELECT department_id, role FROM department_roles WHERE user_id = $1`, [userId]),
            config_1.pool.query(`SELECT object_type, object_id, role FROM object_roles WHERE user_id = $1`, [userId]),
        ]);
        // Highest company role (super_admin > admin > employee > guest)
        const rolePriority = { super_admin: 4, admin: 3, employee: 2, guest: 1 };
        const sortedRoles = [...companyRoles.rows].sort((a, b) => rolePriority[b.role] - rolePriority[a.role]);
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
    async getCompanyRole(userId, companyId) {
        const result = await config_1.pool.query(`SELECT role FROM company_roles WHERE user_id = $1 AND company_id = $2`, [userId, companyId]);
        return result.rows[0]?.role ?? null;
    }
    /**
     * Get department-level role for a user in a department.
     */
    async getDepartmentRole(userId, departmentId) {
        const result = await config_1.pool.query(`SELECT role FROM department_roles WHERE user_id = $1 AND department_id = $2`, [userId, departmentId]);
        return result.rows[0]?.role ?? null;
    }
    /**
     * Get object-level role for a user on a specific object.
     */
    async getObjectRole(userId, objectType, objectId) {
        const result = await config_1.pool.query(`SELECT role FROM object_roles
       WHERE user_id = $1 AND object_type = $2 AND object_id = $3`, [userId, objectType, objectId]);
        return result.rows[0]?.role ?? null;
    }
    /**
     * Check if a user has at least one of the given company roles.
     */
    async hasCompanyRole(userId, companyId, roles) {
        if (roles.length === 0)
            return true;
        const result = await config_1.pool.query(`SELECT 1 FROM company_roles
       WHERE user_id = $1 AND company_id = $2 AND role = ANY($3)`, [userId, companyId, roles]);
        return (result.rowCount ?? 0) > 0;
    }
}
exports.RbacUsersRepository = RbacUsersRepository;
//# sourceMappingURL=users.js.map