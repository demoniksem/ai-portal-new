"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const config_1 = require("../config");
/**
 * AuditService — logs all security-relevant events to the audit_log table.
 * Entries are immutable (insert only, no update/delete).
 */
class AuditService {
    /**
     * Write a single audit log entry.
     */
    async log(params) {
        try {
            await config_1.pool.query(`INSERT INTO audit_log (company_id, actor_id, action, object_type, object_id, old_value, new_value, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                params.companyId,
                params.actorId,
                params.action,
                params.objectType ?? null,
                params.objectId ?? null,
                params.oldValue ? JSON.stringify(params.oldValue) : null,
                params.newValue ? JSON.stringify(params.newValue) : null,
                params.metadata ? JSON.stringify(params.metadata) : null,
            ]);
        }
        catch (err) {
            // Audit failures should not break the main flow — log and continue
            console.error('[AuditService] Failed to write audit log:', err);
        }
    }
    /**
     * Log a user registration event.
     */
    async logUserRegister(companyId, actorId, newUser) {
        await this.log({
            companyId,
            actorId,
            action: 'user.register',
            objectType: 'user',
            objectId: newUser.id,
            newValue: { email: newUser.email },
        });
    }
    /**
     * Log a user login event.
     */
    async logUserLogin(companyId, actorId) {
        await this.log({
            companyId,
            actorId,
            action: 'user.login',
            objectType: 'user',
            objectId: actorId,
        });
    }
    /**
     * Log a user logout event.
     */
    async logUserLogout(companyId, actorId) {
        await this.log({
            companyId,
            actorId,
            action: 'user.logout',
            objectType: 'user',
            objectId: actorId,
        });
    }
    /**
     * Log a role or permission change.
     */
    async logRoleChange(companyId, actorId, targetUserId, oldRole, newRole, scope, scopeId) {
        await this.log({
            companyId,
            actorId,
            action: `role.change.${scope}`,
            objectType: scope,
            objectId: scopeId ?? null,
            oldValue: oldRole ? { role: oldRole, userId: targetUserId } : null,
            newValue: { role: newRole, userId: targetUserId },
            metadata: { targetUserId },
        });
    }
    /**
     * Log a permission denied (403) event.
     */
    async logPermissionDenied(companyId, actorId, action, objectType, objectId) {
        await this.log({
            companyId,
            actorId,
            action: 'auth.denied',
            objectType,
            objectId,
            metadata: { attemptedAction: action },
        });
    }
    /**
     * Retrieve audit log entries with optional filters (Super Admin only).
     */
    async query(params) {
        const conditions = ['company_id = $1'];
        const values = [params.companyId];
        let idx = 2;
        if (params.actorId) {
            conditions.push(`actor_id = $${idx++}`);
            values.push(params.actorId);
        }
        if (params.action) {
            conditions.push(`action = $${idx++}`);
            values.push(params.action);
        }
        if (params.objectType) {
            conditions.push(`object_type = $${idx++}`);
            values.push(params.objectType);
        }
        if (params.objectId) {
            conditions.push(`object_id = $${idx++}`);
            values.push(params.objectId);
        }
        const limit = params.limit ?? 100;
        const offset = params.offset ?? 0;
        values.push(limit, offset);
        const result = await config_1.pool.query(`SELECT id, company_id, actor_id, action, object_type, object_id,
              old_value, new_value, metadata, created_at
       FROM audit_log
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`, values);
        return result.rows.map(row => ({
            id: row.id,
            companyId: row.company_id,
            actorId: row.actor_id,
            action: row.action,
            objectType: row.object_type,
            objectId: row.object_id,
            oldValue: row.old_value,
            newValue: row.new_value,
            metadata: row.metadata,
            createdAt: row.created_at,
        }));
    }
}
exports.AuditService = AuditService;
//# sourceMappingURL=auditService.js.map