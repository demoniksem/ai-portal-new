"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auditService_1 = require("../services/auditService");
const middleware_1 = require("../middleware");
const schemas_1 = require("../schemas");
const config_1 = require("../config");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
const auditService = new auditService_1.AuditService();
// ─── GET /api/admin/audit-log — Super Admin only ────────────────────────────────
// Query params: actorId, action, objectType, objectId, limit (default 100), offset (default 0)
router.get('/audit-log', middleware_1.authMiddleware, middleware_1.requireSuperAdmin, async (req, res) => {
    try {
        const { actorId, action, objectType, objectId, limit, offset } = req.query;
        const entries = await auditService.query({
            companyId: req.user.companyId,
            actorId,
            action,
            objectType,
            objectId,
            limit: limit ? parseInt(limit, 10) : 100,
            offset: offset ? parseInt(offset, 10) : 0,
        });
        return res.json({ entries });
    }
    catch (e) {
        console.error('[Admin] audit-log error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ─── GET /api/admin/ai-config — Admin or Super Admin ───────────────────────────
router.get('/ai-config', middleware_1.authMiddleware, middleware_1.requireAdmin, async (req, res) => {
    const companyId = req.user.companyId;
    const requestId = req.requestId || 'unknown';
    try {
        const result = await config_1.pool.query(`SELECT id, company_id, provider, api_key, model, temperature, max_tokens,
              api_base_url, enabled, created_at, updated_at
       FROM company_ai_config
       WHERE company_id = $1`, [companyId]);
        if (result.rows.length === 0) {
            return res.json({
                provider: 'openrouter',
                model: 'qwen/qwen3.6-plus:free',
                temperature: 0.7,
                maxTokens: 4000,
                apiBaseUrl: null,
                enabled: true,
                hasApiKey: false,
            });
        }
        const row = result.rows[0];
        return res.json({
            id: row.id,
            provider: row.provider,
            hasApiKey: !!(row.api_key && row.api_key.length > 0),
            model: row.model,
            temperature: parseFloat(row.temperature),
            maxTokens: row.max_tokens,
            apiBaseUrl: row.api_base_url,
            enabled: row.enabled,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
    catch (e) {
        logger_1.logger.error({ msg: '[Admin] ai-config GET error', error: e.message, companyId, requestId });
        return res.status(500).json({ error: 'Failed to fetch AI config' });
    }
});
// ─── POST /api/admin/ai-config — Admin or Super Admin (upsert) ─────────────────
router.post('/ai-config', middleware_1.authMiddleware, middleware_1.requireAdmin, (0, middleware_1.validate)(schemas_1.createOrUpdateAiConfigSchema), async (req, res) => {
    const companyId = req.user.companyId;
    const requestId = req.requestId || 'unknown';
    try {
        const { provider, apiKey, model, temperature, maxTokens, apiBaseUrl, enabled } = req.body;
        const result = await config_1.pool.query(`INSERT INTO company_ai_config
         (company_id, provider, api_key, model, temperature, max_tokens, api_base_url, enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (company_id) DO UPDATE SET
         provider   = EXCLUDED.provider,
         api_key    = COALESCE(NULLIF(EXCLUDED.api_key, ''), company_ai_config.api_key),
         model      = EXCLUDED.model,
         temperature = EXCLUDED.temperature,
         max_tokens  = EXCLUDED.max_tokens,
         api_base_url = EXCLUDED.api_base_url,
         enabled    = EXCLUDED.enabled,
         updated_at = NOW()
       RETURNING id, provider, model, temperature, max_tokens, api_base_url, enabled, created_at, updated_at`, [companyId, provider, apiKey || null, model, temperature, maxTokens, apiBaseUrl || null, enabled]);
        const row = result.rows[0];
        await auditService.log({
            companyId,
            actorId: req.user.id,
            action: 'ai_config.update',
            objectType: 'ai_config',
            objectId: row.id,
            newValue: { provider, model, temperature, maxTokens, apiBaseUrl, enabled },
        });
        return res.json({
            id: row.id,
            provider: row.provider,
            hasApiKey: !!(apiKey && apiKey.length > 0) || !!(row.api_key && row.api_key.length > 0),
            model: row.model,
            temperature: parseFloat(row.temperature),
            maxTokens: row.max_tokens,
            apiBaseUrl: row.api_base_url,
            enabled: row.enabled,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
    catch (e) {
        logger_1.logger.error({ msg: '[Admin] ai-config POST error', error: e.message, companyId, requestId });
        return res.status(500).json({ error: 'Failed to save AI config' });
    }
});
// ─── DELETE /api/admin/ai-config — Super Admin only ─────────────────────────────
router.delete('/ai-config', middleware_1.authMiddleware, middleware_1.requireSuperAdmin, async (req, res) => {
    const companyId = req.user.companyId;
    const requestId = req.requestId || 'unknown';
    try {
        const result = await config_1.pool.query('DELETE FROM company_ai_config WHERE company_id = $1 RETURNING id', [companyId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No AI config found for this company' });
        }
        await auditService.log({
            companyId,
            actorId: req.user.id,
            action: 'ai_config.delete',
            objectType: 'ai_config',
            objectId: result.rows[0].id,
        });
        return res.json({ message: 'AI config deleted' });
    }
    catch (e) {
        logger_1.logger.error({ msg: '[Admin] ai-config DELETE error', error: e.message, companyId, requestId });
        return res.status(500).json({ error: 'Failed to delete AI config' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map