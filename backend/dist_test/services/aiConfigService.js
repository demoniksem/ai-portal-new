'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiConfigService = void 0;
const config_1 = require("../config");
const logger_1 = require("../config/logger");
class AiConfigService {
    async getByCompanyId(companyId) {
        const result = await config_1.pool.query(`SELECT id, company_id, provider, api_key, model, temperature,
              max_tokens, api_base_url, enabled, created_at, updated_at
       FROM company_ai_config
       WHERE company_id = $1`, [companyId]);
        return result.rows[0] ?? null;
    }
    async upsert(companyId, data) {
        const { provider, apiKey, model, temperature, maxTokens, apiBaseUrl, enabled } = data;
        const result = await config_1.pool.query(`INSERT INTO company_ai_config
         (company_id, provider, api_key, model, temperature, max_tokens, api_base_url, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (company_id) DO UPDATE SET
         provider   = EXCLUDED.provider,
         api_key    = EXCLUDED.api_key,
         model      = EXCLUDED.model,
         temperature = EXCLUDED.temperature,
         max_tokens = EXCLUDED.max_tokens,
         api_base_url = EXCLUDED.api_base_url,
         enabled    = EXCLUDED.enabled,
         updated_at = NOW()
       RETURNING id, company_id, provider, api_key, model, temperature,
                 max_tokens, api_base_url, enabled, created_at, updated_at`, [
            companyId,
            provider ?? 'openrouter',
            apiKey ?? null,
            model ?? 'qwen/qwen3.6-plus:free',
            temperature ?? 0.7,
            maxTokens ?? 4000,
            apiBaseUrl ?? null,
            enabled ?? true,
        ]);
        logger_1.logger.info({ msg: '[AiConfig] upserted', companyId });
        return result.rows[0];
    }
    async delete(companyId) {
        await config_1.pool.query('DELETE FROM company_ai_config WHERE company_id = $1', [companyId]);
        logger_1.logger.info({ msg: '[AiConfig] deleted', companyId });
    }
}
exports.AiConfigService = AiConfigService;
//# sourceMappingURL=aiConfigService.js.map