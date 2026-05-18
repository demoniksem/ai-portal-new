import { Router, Request, Response } from 'express';
import { authMiddleware, requireAdmin, validate } from '../middleware';
import {
  companyAiConfigSchema,
  updateCompanyAiConfigSchema,
} from '../schemas/aiConfig';
import { AiConfigService } from '../services/aiConfigService';
import { logger } from '../config/logger';

const router: Router = Router();
const aiConfigService = new AiConfigService();

// GET /api/admin/ai-config — get current company AI config
router.get(
  '/',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user?.companyId;
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
    } catch (e) {
      logger.error({ msg: '[AiConfig] GET error', error: (e as Error).message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/admin/ai-config — create or update company AI config
router.post(
  '/',
  authMiddleware,
  requireAdmin,
  validate(companyAiConfigSchema),
  async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user?.companyId;
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
    } catch (e) {
      logger.error({ msg: '[AiConfig] POST error', error: (e as Error).message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/admin/ai-config — partial update
router.patch(
  '/',
  authMiddleware,
  requireAdmin,
  validate(updateCompanyAiConfigSchema),
  async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user?.companyId;
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
    } catch (e) {
      logger.error({ msg: '[AiConfig] PATCH error', error: (e as Error).message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/admin/ai-config — reset to defaults
router.delete(
  '/',
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user?.companyId;
      await aiConfigService.delete(companyId);
      return res.json({ message: 'AI config reset to defaults' });
    } catch (e) {
      logger.error({ msg: '[AiConfig] DELETE error', error: (e as Error).message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
