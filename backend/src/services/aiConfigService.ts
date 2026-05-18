'use strict';

import { pool } from '../config';
import { logger } from '../config/logger';
import { CompanyAiConfigInput } from '../schemas/aiConfig';

export interface CompanyAiConfigRow {
  id: string;
  company_id: string;
  provider: string;
  api_key: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  api_base_url: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export class AiConfigService {
  async getByCompanyId(companyId: string): Promise<CompanyAiConfigRow | null> {
    const result = await pool.query<CompanyAiConfigRow>(
      `SELECT id, company_id, provider, api_key, model, temperature,
              max_tokens, api_base_url, enabled, created_at, updated_at
       FROM company_ai_config
       WHERE company_id = $1`,
      [companyId]
    );
    return result.rows[0] ?? null;
  }

  async upsert(companyId: string, data: CompanyAiConfigInput): Promise<CompanyAiConfigRow> {
    const { provider, apiKey, model, temperature, maxTokens, apiBaseUrl, enabled } = data;

    const result = await pool.query<CompanyAiConfigRow>(
      `INSERT INTO company_ai_config
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
                 max_tokens, api_base_url, enabled, created_at, updated_at`,
      [
        companyId,
        provider ?? 'openrouter',
        apiKey ?? null,
        model ?? 'qwen/qwen3.6-plus:free',
        temperature ?? 0.7,
        maxTokens ?? 4000,
        apiBaseUrl ?? null,
        enabled ?? true,
      ]
    );

    logger.info({ msg: '[AiConfig] upserted', companyId });
    return result.rows[0];
  }

  async delete(companyId: string): Promise<void> {
    await pool.query('DELETE FROM company_ai_config WHERE company_id = $1', [companyId]);
    logger.info({ msg: '[AiConfig] deleted', companyId });
  }
}
