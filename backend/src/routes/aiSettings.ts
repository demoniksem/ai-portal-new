import { Router, Response, Request } from 'express';
import { authMiddleware, validate } from '../middleware';
import { aiSettingsSchema } from '../schemas';
import { logger } from '../config/logger';
import { pool } from '../config';

const router: Router = Router();

const AI_PROVIDER_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  openrouter: [
    { id: 'qwen/qwen3.6-plus:free', name: 'Qwen 3.6 Plus (Free)' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
    { id: 'anthropic/claude-3.5-haiku:free', name: 'Claude 3.5 Haiku (Free)' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  ],
  local: [
    { id: 'local-model', name: 'Local Model (custom endpoint)' },
  ],
  openclaw: [
    { id: 'openclaw/gateway', name: 'OpenClaw Gateway (HTTP API)' },
  ],
};

interface AiSettingsBody {
  provider: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// GET /api/settings/ai
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const requestId = (req as any).requestId || 'unknown';
  try {
    const result = await pool.query(
      'SELECT provider, model, temperature, max_tokens, updated_at FROM ai_settings WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.json({
        provider: 'openrouter',
        model: 'qwen/qwen3.6-plus:free',
        temperature: 0.7,
        maxTokens: 4000,
        availableModels: AI_PROVIDER_MODELS.openrouter,
      });
    }
    const row = result.rows[0];
    const availableModels = AI_PROVIDER_MODELS[row.provider] || AI_PROVIDER_MODELS.openrouter;
    return res.json({
      provider: row.provider,
      model: row.model,
      temperature: parseFloat(row.temperature),
      maxTokens: row.max_tokens,
      hasApiKey: !!(row.api_key && row.api_key.length > 0),
      availableModels,
    });
  } catch (e) {
    logger.error({ msg: 'AI settings GET error', error: (e as Error).message, requestId });
    return res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

// PUT /api/settings/ai
router.put('/', authMiddleware, validate(aiSettingsSchema), async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const requestId = (req as any).requestId || 'unknown';
  try {
    const { provider, apiKey, model, temperature, maxTokens } = req.body as unknown as AiSettingsBody;

    const result = await pool.query(
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
      [userId, provider, apiKey || null, model, temperature, maxTokens]
    );

    const row = result.rows[0];
    const availableModels = AI_PROVIDER_MODELS[row.provider] || AI_PROVIDER_MODELS.openrouter;
    return res.json({
      provider: row.provider,
      model: row.model,
      temperature: parseFloat(row.temperature),
      maxTokens: row.max_tokens,
      hasApiKey: !!(apiKey && apiKey.length > 0),
      availableModels,
    });
  } catch (e) {
    logger.error({ msg: 'AI settings PUT error', error: (e as Error).message, requestId });
    return res.status(500).json({ error: 'Failed to update AI settings' });
  }
});

// GET /api/settings/ai/providers
router.get('/providers', authMiddleware, async (req: Request, res: Response) => {
  return res.json(AI_PROVIDER_MODELS);
});

// POST /api/settings/ai/test
router.post('/test', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const requestId = (req as any).requestId || 'unknown';
  try {
    const settingsResult = await pool.query(
      'SELECT provider, api_key, model, temperature, max_tokens FROM ai_settings WHERE user_id = $1',
      [userId]
    );
    const settings = settingsResult.rows[0] || {};
    const provider = settings.provider || 'openrouter';
    const apiKey = settings.api_key || process.env.OPENROUTER_API_KEY;
    const model = settings.model || 'qwen/qwen3.6-plus:free';

    if (!apiKey) {
      return res.status(400).json({ error: 'No API key configured. Please set your API key in AI Settings.' });
    }

    let testResponse;
    if (provider === 'openrouter') {
      testResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI Portal',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with exactly one word: OK' }],
          temperature: 0.1,
          max_tokens: 10,
        }),
      });
    } else if (provider === 'openai') {
      testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with exactly one word: OK' }],
          temperature: 0.1,
          max_tokens: 10,
        }),
      });
    } else if (provider === 'anthropic') {
      testResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with exactly one word: OK' }],
          temperature: 0.1,
          max_tokens: 10,
        }),
      });
    } else {
      return res.status(400).json({ error: `Provider '${provider}' test not implemented yet.` });
    }

    if (!testResponse.ok) {
      const errText = await testResponse.text();
      return res.status(400).json({ error: `Provider API error (${testResponse.status}): ${errText.slice(0, 200)}` });
    }

    const data = await testResponse.json() as { model?: string; [key: string]: unknown };
    return res.json({ success: true, message: 'Connection successful', model: data.model || model });
  } catch (e) {
    logger.error({ msg: 'AI test error', error: (e as Error).message, requestId });
    return res.status(500).json({ error: 'Connection test failed: ' + (e as Error).message });
  }
});

export default router;