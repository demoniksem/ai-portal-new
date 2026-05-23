import { Router, Response, Request } from 'express';
import { authMiddleware, aiLimiter, validate } from '../middleware';
import { aiBuildSchema } from '../schemas';
import { UsersRepository } from '../repositories/users';
import { logger } from '../config/logger';
import { pool, OPENCLAW_GATEWAY_URL } from '../config';

const router: Router = Router();
const usersRepo = new UsersRepository();

// ── AI Config Resolution ──────────────────────────────────────────────────────
// Priority: per-user ai_settings → company_ai_config → env vars → hardcoded defaults
interface AiConfig {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  apiBaseUrl?: string;
}

async function resolveAiConfig(userId: string | undefined, companyId: string | undefined): Promise<AiConfig> {
  const defaults: AiConfig = {
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: 'qwen/qwen3.6-plus:free',
    temperature: 0.7,
    maxTokens: 4000,
    apiBaseUrl: undefined,
  };

  let config = { ...defaults };

  // 1. Company-level config (company_ai_config)
  if (companyId) {
    try {
      const companyResult = await pool.query<{
        provider: string; api_key: string | null; model: string;
        temperature: string; max_tokens: number; api_base_url: string | null;
      }>(
        `SELECT provider, api_key, model, temperature, max_tokens, api_base_url
         FROM company_ai_config WHERE company_id = $1 AND enabled = true`,
        [companyId]
      );
      if (companyResult.rows.length > 0) {
        const c = companyResult.rows[0];
        config.provider = c.provider || config.provider;
        if (c.api_key) config.apiKey = c.api_key;
        config.model = c.model || config.model;
        config.temperature = parseFloat(c.temperature) || config.temperature;
        config.maxTokens = c.max_tokens || config.maxTokens;
        if (c.api_base_url) config.apiBaseUrl = c.api_base_url;
      }
    } catch (e) {
      logger.warn({ msg: 'resolveAiConfig: company_ai_config query failed, skipping', error: (e as Error).message });
    }
  }

  // 2. Per-user override (ai_settings)
  if (userId) {
    try {
      const userResult = await pool.query<{
        provider: string; api_key: string | null; model: string;
        temperature: string; max_tokens: number;
      }>(
        `SELECT provider, api_key, model, temperature, max_tokens
         FROM ai_settings WHERE user_id = $1`,
        [userId]
      );
      if (userResult.rows.length > 0) {
        const u = userResult.rows[0];
        config.provider = u.provider || config.provider;
        if (u.api_key) config.apiKey = u.api_key;
        config.model = u.model || config.model;
        config.temperature = parseFloat(u.temperature) || config.temperature;
        config.maxTokens = u.max_tokens || config.maxTokens;
      }
    } catch (e) {
      logger.warn({ msg: 'resolveAiConfig: ai_settings query failed, skipping', error: (e as Error).message });
    }
  }

  return config;
}

// Providers that speak the Anthropic Messages protocol (e.g. MiniMax's
// Anthropic-compatible endpoint at https://api.minimax.io/anthropic).
const ANTHROPIC_PROTOCOL_PROVIDERS = new Set(['minimax', 'anthropic']);

interface LlmResult { ok: boolean; status: number; text: string; error?: string; }

// Single chat completion. Handles both the OpenAI chat/completions protocol
// (openrouter, openai) and the Anthropic Messages protocol (minimax, anthropic),
// honoring a custom apiBaseUrl for the latter. Returns the assistant text.
async function llmComplete(opts: {
  provider: string; apiKey: string; apiBaseUrl?: string; model: string;
  system: string; user: string; temperature: number; maxTokens: number;
}): Promise<LlmResult> {
  const { provider, apiKey, apiBaseUrl, model, system, user, temperature, maxTokens } = opts;

  if (ANTHROPIC_PROTOCOL_PROVIDERS.has(provider)) {
    const base = (apiBaseUrl || 'https://api.minimax.io/anthropic').replace(/\/+$/, '');
    const resp = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!resp.ok) return { ok: false, status: resp.status, text: '', error: await resp.text() };
    const data = await resp.json() as { content?: Array<{ type?: string; text?: string }> };
    // Reasoning models (e.g. MiniMax-M2) emit a `thinking` block before `text`;
    // keep only the text blocks.
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('');
    return { ok: true, status: 200, text };
  }

  const apiUrl = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : null;
  if (!apiUrl) return { ok: false, status: 0, text: '', error: `Provider '${provider}' is not yet supported for generation.` };

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'AI Portal' } : {}),
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature, max_tokens: maxTokens,
    }),
  });
  if (!resp.ok) return { ok: false, status: resp.status, text: '', error: await resp.text() };
  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { ok: true, status: 200, text: data.choices?.[0]?.message?.content || '' };
}

const AI_SYSTEM_PROMPT = `Ты — AI-архитектор страниц для корпоративного портала. Твоя задача — превратить текстовый промпт пользователя в JSON-спецификацию страницы.

Формат ответа — ТОЛЬКО JSON, без пояснений. Структура:
{
  "title": "Заголовок страницы",
  "content": [...]
}

## Типы блоков контента:

### Базовые блоки:
- {"type": "heading", "text": "Заголовок раздела"} — заголовок секции (H2)
- {"type": "text", "text": "Текст абзаца"} — обычный текст
- {"type": "table", "headers": ["Колонка 1", "Колонка 2"], "rows": [["Данные", "Данные"]]} — таблица с данными
- {"type": "list", "items": ["Пункт 1", "Пункт 2"]} — маркированный список
- {"type": "code", "code": "function hello() {}"} — блок кода

### Макросы (тип "macro"):
1. **panel** — цветной информационный блок: {"type": "macro", "macroName": "info", "macroProps": {"title": "Важно", "children": "Текст примечания"}}
2. **status** — цветной бейдж статуса: {"type": "macro", "macroName": "status", "macroProps": {"status": "done"}}
3. **expand** — раскрываемый блок: {"type": "macro", "macroName": "expand", "macroProps": {"title": "Нажми чтобы раскрыть", "children": "Скрытый контент"}}
4. **decision** — запись решений: {"type": "macro", "macroName": "decision", "macroProps": {"description": "Текст решения", "author": "Иван Иванов", "date": "2026-04-03", "status": "approved"}}
5. **mention** — упоминание человека: {"type": "macro", "macroName": "mention", "macroProps": {"name": "Алексей"}}
6. **quote** — цитата: {"type": "macro", "macroName": "quote", "macroProps": {"children": "Текст цитаты"}}
7. **divider** — горизонтальная линия: {"type": "macro", "macroName": "divider", "macroProps": {}}
8. **video** — встраивание видео: {"type": "macro", "macroName": "video", "macroProps": {"title": "Демо", "src": "https://youtube.com/embed/...", "height": 400}}
9. **toc** — оглавление: {"type": "macro", "macroName": "toc", "macroProps": {}}
10. **chart** — диаграмма: {"type": "macro", "macroName": "chart", "macroProps": {"title": "Прогресс проекта", "type": "bar", "data": {"labels": ["Янв","Фев","Мар"], "values": [30, 50, 75]}}}
11. **calendar** — календарь: {"type": "macro", "macroName": "calendar", "macroProps": {"events": [{"date":"2026-04-15","title":"Дедлайн"}]}}
12. **progress** — прогресс-бар: {"type": "macro", "macroName": "progress", "macroProps": {"title": "Прогресс спринта", "percent": 65}}
13. **livesearch** — встроенный поиск: {"type": "macro", "macroName": "livesearch", "macroProps": {}}
14. **properties** — свойства страницы: {"type": "macro", "macroName": "properties", "macroProps": {"properties": {"Владелец": "Иван", "Отдел": "Разработка"}}}
15. **properties_report** — сводная таблица: {"type": "macro", "macroName": "properties_report", "macroProps": {}}
16. **comments** — блок комментариев: {"type": "macro", "macroName": "comments", "macroProps": {}}
17. **jira_issues** — задачи из Jira: {"type": "macro", "macroName": "jira_issues", "macroProps": {"jiraUrl": "https://company.atlassian.net", "jql": "project = PROJ"}}
18. **github_issues** — issue из GitHub: {"type": "macro", "macroName": "github_issues", "macroProps": {"repo": "owner/repo", "state": "open"}}
19. **notifications** — блок уведомлений: {"type": "macro", "macroName": "notifications", "macroProps": {}}

## Правила:
- Минимум 8-15 блоков контента
- Генерируй РЕАЛИСТИЧНЫЙ контент — конкретные имена, числа, даты
- Обязательно используй макросы — минимум 3-5 макросов на страницу
- Отвечай НА РУССКОМ языке
- Ответ — ВАЛИДНЫЙ JSON, без markdown-обёрток
- НЕ оборачивай ответ в backtick-блоки — только чистый JSON.`;

interface BuildBody {
  prompt: string;
}

// POST /api/ai/build
router.post('/build', authMiddleware, aiLimiter, validate(aiBuildSchema), async (req: Request, res: Response) => {
  const { prompt } = req.body as unknown as BuildBody;
  const userId = (req as any).user?.id as string | undefined;
  const companyId = (req as any).user?.companyId as string | undefined;
  const requestId = (req as any).requestId || 'unknown';

  const { provider, apiKey, model, temperature, maxTokens, apiBaseUrl } = await resolveAiConfig(userId, companyId);

  if (!apiKey && provider !== 'openclaw') {
    return res.status(503).json({ error: 'AI API key not configured. Go to Settings → AI to set your API key.' });
  }

  // OpenClaw Gateway — HTTP API (no API key required, uses gateway URL)
  if (provider === 'openclaw') {
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 3000;
        logger.info({ msg: `OpenClaw retry ${attempt}/3`, delay, requestId });
        await new Promise(r => setTimeout(r, delay));
      }

      try {
        const ocResponse = await fetch(`${OPENCLAW_GATEWAY_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || 'openrouter/qwen/qwen3.6-plus:free',
            messages: [
              { role: 'system', content: AI_SYSTEM_PROMPT },
              { role: 'user', content: prompt }
            ],
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!ocResponse.ok) {
          const errText = await ocResponse.text();
          logger.error({ msg: `OpenClaw Gateway error`, status: ocResponse.status, errText, requestId });
          lastError = `Gateway ${ocResponse.status}: ${errText.slice(0, 100)}`;
          continue;
        }

        const data = await ocResponse.json() as { content?: string; message?: { content?: string }; [key: string]: unknown };
        let rawContent = typeof data === 'string' ? data : (data.content || data.message?.content || JSON.stringify(data));
        rawContent = (rawContent as string).replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

        const jsonMatch = (rawContent as string).match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = 'OpenClaw returned non-JSON response';
          break;
        }

        const spec = JSON.parse(jsonMatch[0]);
        if (!spec.title) spec.title = prompt.slice(0, 60);
        if (!spec.content || !Array.isArray(spec.content)) {
          spec.content = [
            { type: 'heading', text: spec.title },
            { type: 'text', text: (rawContent as string).slice(0, 500) }
          ];
        }

        logger.info({ msg: 'OpenClaw build success', model, requestId });
        return res.json(spec);
      } catch (e) {
        logger.error({ msg: `OpenClaw build error (attempt ${attempt + 1})`, error: (e as Error).message, requestId });
        lastError = (e as Error).message;
      }
    }

    logger.error({ msg: 'OpenClaw Gateway failed', lastError, requestId });
    return res.status(503).json({
      error: 'OpenClaw Gateway недоступен. Убедитесь что OpenClaw Gateway запущен на ' + OPENCLAW_GATEWAY_URL,
      hint: lastError,
    });
  }

  const freeFallbackModels = ['qwen/qwen3.6-plus:free', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.1-8b-instruct:free'];
  // Free-model fallbacks only make sense for OpenRouter; other providers
  // (openai, minimax, anthropic) use exactly the configured model.
  const modelsToTry = provider === 'openrouter' ? [model, ...freeFallbackModels.filter(m => m !== model)] : [model];
  let lastError = '';

  for (const mdl of modelsToTry) {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          const delay = attempt * 3000;
          logger.info({ msg: `AI retry ${attempt}/3 for ${mdl}`, delay, requestId });
          await new Promise(r => setTimeout(r, delay));
        }

        const result = await llmComplete({
          provider, apiKey, apiBaseUrl, model: mdl,
          system: AI_SYSTEM_PROMPT, user: prompt, temperature, maxTokens,
        });

        if (result.status === 429) {
          logger.warn({ msg: `AI 429 on ${mdl}`, requestId });
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }

        if (!result.ok) {
          logger.error({ msg: `AI error (${mdl})`, status: result.status, errText: result.error, requestId });
          lastError = result.error && /not yet supported/.test(result.error)
            ? result.error
            : (result.status ? `AI API error: ${result.status}` : (result.error || 'AI call failed'));
          break;
        }

        let rawContent = result.text;

        rawContent = (rawContent as string).replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

        const jsonMatch = (rawContent as string).match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = 'AI returned non-JSON response';
          break;
        }

        const spec = JSON.parse(jsonMatch[0]);
        if (!spec.title) spec.title = prompt.slice(0, 60);
        if (!spec.content || !Array.isArray(spec.content)) {
          spec.content = [
            { type: 'heading', text: spec.title },
            { type: 'text', text: (rawContent as string).slice(0, 500) }
          ];
        }

        logger.info({ msg: `AI build success`, model: mdl, requestId });
        return res.json(spec);
      }
    } catch (e) {
      logger.error({ msg: `AI build error on ${mdl}`, error: (e as Error).message, requestId });
      lastError = (e as Error).message;
    }
  }

      return res.status(502).json({
        error: 'AI генерация недоступна (rate limit). Попробуйте через минуту.',
        hint: lastError
      });
});

// POST /api/ai/build-board — generate board + cards from goal prompt
router.post('/build-board', authMiddleware, async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };
  const userId = (req as any).user?.id as string | undefined;
  const requestId = (req as any).requestId || 'unknown';

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const BOARD_SYSTEM_PROMPT = `Ты — AI-архитектор задач для корпоративного портала. Преврати цель пользователя в план-доску с колонками и карточками задач.

Формат ответа — ТОЛЬКО JSON (чистый JSON без обёрток):
{
  "title": "Название доски",
  "columns": [
    { "name": "Backlog", "wipLimit": null },
    { "name": "To Do", "wipLimit": 5 },
    { "name": "In Progress", "wipLimit": 3 },
    { "name": "Done", "wipLimit": null }
  ],
  "cards": [
    {
      "title": "Название задачи",
      "description": "Краткое описание (1-2 предложения)",
      "priority": "high",
      "assignee": null,
      "labels": ["frontend", "api"],
      "dueDate": null
    }
  ]
}

Правила:
- Генерируй 4-6 карточек для типичной задачи, 8-12 для сложных проектов
- column names: только "Backlog", "To Do", "In Progress", "Review", "Done" или подобные стандартные
- priority: только "low", "medium", "high", "critical"
- assignee: null или имя реального человека
- labels: 1-3 тега из реального контекста задачи
- dueDate: null или ISO строка "2026-05-25"
- description — конкретное описание что нужно сделать
- Отвечай НА РУССКОМ языке
- ВАЛИДНЫЙ JSON, без markdown, без backtick`;

  const { provider, apiKey, model, temperature, maxTokens, apiBaseUrl } = await resolveAiConfig(userId, (req as any).user?.companyId);

  if (!apiKey && provider !== 'openclaw') {
    return res.status(503).json({ error: 'AI API key not configured. Go to Settings → AI to set your API key.' });
  }

  const freeFallbackModels = ['qwen/qwen3.6-plus:free', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.1-8b-instruct:free'];
  // Free-model fallbacks only make sense for OpenRouter; other providers
  // (openai, minimax, anthropic) use exactly the configured model.
  const modelsToTry = provider === 'openrouter' ? [model, ...freeFallbackModels.filter(m => m !== model)] : [model];
  let lastError = '';

  for (const mdl of modelsToTry) {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, attempt * 3000));
        }

        const result = await llmComplete({
          provider, apiKey, apiBaseUrl, model: mdl,
          system: BOARD_SYSTEM_PROMPT, user: prompt, temperature, maxTokens,
        });

        if (result.status === 429) {
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }

        if (!result.ok) {
          lastError = result.error && /not yet supported/.test(result.error)
            ? result.error
            : (result.status ? `AI API error: ${result.status}` : (result.error || 'AI call failed'));
          break;
        }

        let rawContent = result.text;

        rawContent = (rawContent as string).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

        const jsonMatch = (rawContent as string).match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = 'AI returned non-JSON response';
          break;
        }

        const spec = JSON.parse(jsonMatch[0]) as { title?: string; columns?: unknown[]; cards?: unknown[] };

        if (!spec.title) spec.title = prompt.slice(0, 60);
        if (!Array.isArray(spec.columns)) spec.columns = [{ name: 'To Do', wipLimit: null }];
        if (!Array.isArray(spec.cards)) spec.cards = [];

        logger.info({ msg: 'AI build-board success', model: mdl, requestId });
        return res.json(spec);
      }
    } catch (e) {
      logger.error({ msg: `AI build-board error on ${mdl}`, error: (e as Error).message, requestId });
      lastError = (e as Error).message;
    }
  }

  return res.status(502).json({
    error: 'AI board generation unavailable. Try again in a moment.',
    hint: lastError,
  });
});

export default router;