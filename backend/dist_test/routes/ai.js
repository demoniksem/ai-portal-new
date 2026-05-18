"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const middleware_1 = require("../middleware");
const schemas_1 = require("../schemas");
const users_1 = require("../repositories/users");
const logger_1 = require("../config/logger");
const config_1 = require("../config");
const router = (0, express_1.Router)();
const usersRepo = new users_1.UsersRepository();
async function resolveAiConfig(userId, companyId) {
    const defaults = {
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
            const companyResult = await config_1.pool.query(`SELECT provider, api_key, model, temperature, max_tokens, api_base_url
         FROM company_ai_config WHERE company_id = $1 AND enabled = true`, [companyId]);
            if (companyResult.rows.length > 0) {
                const c = companyResult.rows[0];
                config.provider = c.provider || config.provider;
                if (c.api_key)
                    config.apiKey = c.api_key;
                config.model = c.model || config.model;
                config.temperature = parseFloat(c.temperature) || config.temperature;
                config.maxTokens = c.max_tokens || config.maxTokens;
                if (c.api_base_url)
                    config.apiBaseUrl = c.api_base_url;
            }
        }
        catch (e) {
            logger_1.logger.warn({ msg: 'resolveAiConfig: company_ai_config query failed, skipping', error: e.message });
        }
    }
    // 2. Per-user override (ai_settings)
    if (userId) {
        try {
            const userResult = await config_1.pool.query(`SELECT provider, api_key, model, temperature, max_tokens
         FROM ai_settings WHERE user_id = $1`, [userId]);
            if (userResult.rows.length > 0) {
                const u = userResult.rows[0];
                config.provider = u.provider || config.provider;
                if (u.api_key)
                    config.apiKey = u.api_key;
                config.model = u.model || config.model;
                config.temperature = parseFloat(u.temperature) || config.temperature;
                config.maxTokens = u.max_tokens || config.maxTokens;
            }
        }
        catch (e) {
            logger_1.logger.warn({ msg: 'resolveAiConfig: ai_settings query failed, skipping', error: e.message });
        }
    }
    return config;
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
// POST /api/ai/build
router.post('/build', middleware_1.authMiddleware, middleware_1.aiLimiter, (0, middleware_1.validate)(schemas_1.aiBuildSchema), async (req, res) => {
    const { prompt } = req.body;
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    const requestId = req.requestId || 'unknown';
    const { provider, apiKey, model, temperature, maxTokens } = await resolveAiConfig(userId, companyId);
    if (!apiKey && provider !== 'openclaw') {
        return res.status(503).json({ error: 'AI API key not configured. Go to Settings → AI to set your API key.' });
    }
    // OpenClaw Gateway — HTTP API (no API key required, uses gateway URL)
    if (provider === 'openclaw') {
        let lastError = '';
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
                const delay = attempt * 3000;
                logger_1.logger.info({ msg: `OpenClaw retry ${attempt}/3`, delay, requestId });
                await new Promise(r => setTimeout(r, delay));
            }
            try {
                const ocResponse = await fetch(`${config_1.OPENCLAW_GATEWAY_URL}/api/chat`, {
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
                    logger_1.logger.error({ msg: `OpenClaw Gateway error`, status: ocResponse.status, errText, requestId });
                    lastError = `Gateway ${ocResponse.status}: ${errText.slice(0, 100)}`;
                    continue;
                }
                const data = await ocResponse.json();
                let rawContent = typeof data === 'string' ? data : (data.content || data.message?.content || JSON.stringify(data));
                rawContent = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
                const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    lastError = 'OpenClaw returned non-JSON response';
                    break;
                }
                const spec = JSON.parse(jsonMatch[0]);
                if (!spec.title)
                    spec.title = prompt.slice(0, 60);
                if (!spec.content || !Array.isArray(spec.content)) {
                    spec.content = [
                        { type: 'heading', text: spec.title },
                        { type: 'text', text: rawContent.slice(0, 500) }
                    ];
                }
                logger_1.logger.info({ msg: 'OpenClaw build success', model, requestId });
                return res.json(spec);
            }
            catch (e) {
                logger_1.logger.error({ msg: `OpenClaw build error (attempt ${attempt + 1})`, error: e.message, requestId });
                lastError = e.message;
            }
        }
        logger_1.logger.error({ msg: 'OpenClaw Gateway failed', lastError, requestId });
        return res.status(503).json({
            error: 'OpenClaw Gateway недоступен. Убедитесь что OpenClaw Gateway запущен на ' + config_1.OPENCLAW_GATEWAY_URL,
            hint: lastError,
        });
    }
    const freeFallbackModels = ['qwen/qwen3.6-plus:free', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.1-8b-instruct:free'];
    const modelsToTry = [model, ...freeFallbackModels.filter(m => m !== model)];
    let lastError = '';
    for (const mdl of modelsToTry) {
        try {
            const reqBody = {
                model: mdl,
                messages: [
                    { role: 'system', content: AI_SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ],
                temperature,
                max_tokens: maxTokens
            };
            let response;
            for (let attempt = 0; attempt < 3; attempt++) {
                if (attempt > 0) {
                    const delay = attempt * 3000;
                    logger_1.logger.info({ msg: `AI retry ${attempt}/3 for ${mdl}`, delay, requestId });
                    await new Promise(r => setTimeout(r, delay));
                }
                const apiUrl = provider === 'openrouter'
                    ? 'https://openrouter.ai/api/v1/chat/completions'
                    : provider === 'openai'
                        ? 'https://api.openai.com/v1/chat/completions'
                        : null;
                if (!apiUrl) {
                    lastError = `Provider '${provider}' is not yet supported for generation.`;
                    break;
                }
                const headers = {
                    'Content-Type': 'application/json',
                    ...(provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'AI Portal' } : {}),
                    'Authorization': `Bearer ${apiKey}`,
                };
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(reqBody)
                });
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 4000;
                    logger_1.logger.warn({ msg: `AI 429 on ${mdl}`, waitMs, requestId });
                    await new Promise(r => setTimeout(r, waitMs));
                    continue;
                }
                if (!response.ok) {
                    const errText = await response.text();
                    logger_1.logger.error({ msg: `AI error (${mdl})`, status: response.status, errText, requestId });
                    lastError = `AI API error: ${response.status}`;
                    break;
                }
                const data = await response.json();
                let rawContent = data.choices?.[0]?.message?.content || '';
                rawContent = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
                const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    lastError = 'AI returned non-JSON response';
                    break;
                }
                const spec = JSON.parse(jsonMatch[0]);
                if (!spec.title)
                    spec.title = prompt.slice(0, 60);
                if (!spec.content || !Array.isArray(spec.content)) {
                    spec.content = [
                        { type: 'heading', text: spec.title },
                        { type: 'text', text: rawContent.slice(0, 500) }
                    ];
                }
                logger_1.logger.info({ msg: `AI build success`, model: mdl, requestId });
                return res.json(spec);
            }
        }
        catch (e) {
            logger_1.logger.error({ msg: `AI build error on ${mdl}`, error: e.message, requestId });
            lastError = e.message;
        }
    }
    return res.status(502).json({
        error: 'AI генерация недоступна (rate limit). Попробуйте через минуту.',
        hint: lastError
    });
});
// POST /api/ai/build-board — generate board + cards from goal prompt
router.post('/build-board', middleware_1.authMiddleware, async (req, res) => {
    const { prompt } = req.body;
    const userId = req.user?.id;
    const requestId = req.requestId || 'unknown';
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
    const { provider, apiKey, model, temperature, maxTokens } = await resolveAiConfig(userId, req.user?.companyId);
    if (!apiKey && provider !== 'openclaw') {
        return res.status(503).json({ error: 'AI API key not configured. Go to Settings → AI to set your API key.' });
    }
    const freeFallbackModels = ['qwen/qwen3.6-plus:free', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.1-8b-instruct:free'];
    const modelsToTry = [model, ...freeFallbackModels.filter(m => m !== model)];
    let lastError = '';
    for (const mdl of modelsToTry) {
        try {
            const reqBody = {
                model: mdl,
                messages: [
                    { role: 'system', content: BOARD_SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ],
                temperature,
                max_tokens: maxTokens
            };
            let response;
            for (let attempt = 0; attempt < 3; attempt++) {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, attempt * 3000));
                }
                const apiUrl = provider === 'openrouter'
                    ? 'https://openrouter.ai/api/v1/chat/completions'
                    : provider === 'openai'
                        ? 'https://api.openai.com/v1/chat/completions'
                        : null;
                if (!apiUrl) {
                    lastError = `Provider '${provider}' is not yet supported.`;
                    break;
                }
                const headers = {
                    'Content-Type': 'application/json',
                    ...(provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'AI Portal' } : {}),
                    'Authorization': `Bearer ${apiKey}`,
                };
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(reqBody)
                });
                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 4000));
                    continue;
                }
                if (!response.ok) {
                    lastError = `AI API error: ${response.status}`;
                    break;
                }
                const data = await response.json();
                let rawContent = data.choices?.[0]?.message?.content || '';
                rawContent = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
                const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    lastError = 'AI returned non-JSON response';
                    break;
                }
                const spec = JSON.parse(jsonMatch[0]);
                if (!spec.title)
                    spec.title = prompt.slice(0, 60);
                if (!Array.isArray(spec.columns))
                    spec.columns = [{ name: 'To Do', wipLimit: null }];
                if (!Array.isArray(spec.cards))
                    spec.cards = [];
                logger_1.logger.info({ msg: 'AI build-board success', model: mdl, requestId });
                return res.json(spec);
            }
        }
        catch (e) {
            logger_1.logger.error({ msg: `AI build-board error on ${mdl}`, error: e.message, requestId });
            lastError = e.message;
        }
    }
    return res.status(502).json({
        error: 'AI board generation unavailable. Try again in a moment.',
        hint: lastError,
    });
});
exports.default = router;
//# sourceMappingURL=ai.js.map