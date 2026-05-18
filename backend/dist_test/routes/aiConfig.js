"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const middleware_1 = require("../middleware");
const aiConfig_1 = require("../schemas/aiConfig");
const aiConfigService_1 = require("../services/aiConfigService");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
const aiConfigService = new aiConfigService_1.AiConfigService();
// GET /api/admin/ai-config — get current company AI config
router.get('/', middleware_1.authMiddleware, middleware_1.requireAdmin, async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const config = await aiConfigService.getByCompanyId(companyId);
        if (!config) {
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
        return res.json({
            id: config.id,
            provider: config.provider,
            model: config.model,
            temperature: Number(config.temperature),
            maxTokens: config.max_tokens,
            apiBaseUrl: config.api_base_url,
            enabled: config.enabled,
            hasApiKey: !!config.api_key,
            updatedAt: config.updated_at,
        });
    }
    catch (e) {
        logger_1.logger.error({ msg: '[AiConfig] GET error', error: e.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/admin/ai-config — create or update company AI config
router.post('/', middleware_1.authMiddleware, middleware_1.requireAdmin, (0, middleware_1.validate)(aiConfig_1.companyAiConfigSchema), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const data = req.body;
        const config = await aiConfigService.upsert(companyId, {
            provider: data.provider,
            apiKey: data.apiKey,
            model: data.model,
            temperature: data.temperature,
            maxTokens: data.maxTokens,
            apiBaseUrl: data.apiBaseUrl,
            enabled: data.enabled,
        });
        return res.json({
            id: config.id,
            provider: config.provider,
            model: config.model,
            temperature: Number(config.temperature),
            maxTokens: config.max_tokens,
            apiBaseUrl: config.api_base_url,
            enabled: config.enabled,
            hasApiKey: !!config.api_key,
            updatedAt: config.updated_at,
        });
    }
    catch (e) {
        logger_1.logger.error({ msg: '[AiConfig] POST error', error: e.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PATCH /api/admin/ai-config — partial update
router.patch('/', middleware_1.authMiddleware, middleware_1.requireAdmin, (0, middleware_1.validate)(aiConfig_1.updateCompanyAiConfigSchema), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const data = req.body;
        // Fetch current config first
        const current = await aiConfigService.getByCompanyId(companyId);
        if (!current) {
            return res.status(404).json({ error: 'AI config not found. Use POST to create.' });
        }
        const merged = {
            provider: data.provider ?? current.provider,
            apiKey: data.apiKey !== undefined ? data.apiKey : current.api_key,
            model: data.model ?? current.model,
            temperature: data.temperature !== undefined ? data.temperature : Number(current.temperature),
            maxTokens: data.maxTokens !== undefined ? data.maxTokens : current.max_tokens,
            apiBaseUrl: data.apiBaseUrl !== undefined ? data.apiBaseUrl : current.api_base_url,
            enabled: data.enabled !== undefined ? data.enabled : current.enabled,
        };
        const config = await aiConfigService.upsert(companyId, merged);
        return res.json({
            id: config.id,
            provider: config.provider,
            model: config.model,
            temperature: Number(config.temperature),
            maxTokens: config.max_tokens,
            apiBaseUrl: config.api_base_url,
            enabled: config.enabled,
            hasApiKey: !!config.api_key,
            updatedAt: config.updated_at,
        });
    }
    catch (e) {
        logger_1.logger.error({ msg: '[AiConfig] PATCH error', error: e.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/admin/ai-config — reset to defaults
router.delete('/', middleware_1.authMiddleware, middleware_1.requireAdmin, async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        await aiConfigService.delete(companyId);
        return res.json({ message: 'AI config reset to defaults' });
    }
    catch (e) {
        logger_1.logger.error({ msg: '[AiConfig] DELETE error', error: e.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=aiConfig.js.map