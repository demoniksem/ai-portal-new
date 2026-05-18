"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_PROVIDER_MODELS = exports.AIService = void 0;
const logger_1 = require("../config/logger");
const config_1 = require("../config");
const users_1 = require("../repositories/users");
const usersRepo = new users_1.UsersRepository();
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

### Макросы (тип "macro") — как в Confluence:

1. **panel** — цветной информационный блок, как Info/Tip/Note/Warning:
   {"type": "macro", "macroName": "info", "macroProps": {"title": "Важно", "children": "Текст примечания"}}
   macroName может быть: "info" (синий), "tip" (зелёный), "note" (жёлтый), "warning" (красный), "panel"

2. **status** — цветной бейдж статуса:
   {"type": "macro", "macroName": "status", "macroProps": {"status": "done"}}
   status: "done" (✓ зелёный), "in_progress" (◐ жёлтый), "blocked" (✗ красный), "review" (◇ синий), "testing" (⧗ оранжевый)
   Или: {"macroProps": {"label": "Кастомный статус"}}

3. **expand** — раскрываемый/сворачиваемый блок (FAQ, шаги):
   {"type": "macro", "macroName": "expand", "macroProps": {"title": "Нажми чтобы раскрыть", "children": "Скрытый контент"}}

4. **decision** — макрос для записи решений:
   {"type": "macro", "macroName": "decision", "macroProps": {"description": "Текст решения", "author": "Иван Иванов", "date": "2026-04-03", "status": "approved"}}

5. **mention** — упоминание человека:
   {"type": "macro", "macroName": "mention", "macroProps": {"name": "Алексей"}}

6. **quote** — цитата / блок-цитата:
   {"type": "macro", "macroName": "quote", "macroProps": {"children": "Текст цитаты"}}

7. **divider** — горизонтальная линия-разделитель:
   {"type": "macro", "macroName": "divider", "macroProps": {}}

8. **video** — встраивание видео (YouTube, Loom):
   {"type": "macro", "macroName": "video", "macroProps": {"title": "Демо", "src": "https://youtube.com/embed/...", "height": 400}}

9. **toc** — оглавление страницы (автоматическое):
   {"type": "macro", "macroName": "toc", "macroProps": {}}

10. **chart** — визуализация данных (диаграмма):
    {"type": "macro", "macroName": "chart", "macroProps": {"title": "Прогресс проекта", "type": "bar", "data": {"labels": ["Янв","Фев","Мар"], "values": [30, 50, 75]}}}

11. **calendar** — календарь с событиями:
    {"type": "macro", "macroName": "calendar", "macroProps": {"events": [{"date":"2026-04-15","title":"Дедлайн"},{"date":"2026-04-20","title":"Релиз"}]}}

12. **progress** — прогресс-бар:
    {"type": "macro", "macroName": "progress", "macroProps": {"title": "Прогресс спринта", "percent": 65}}

14. **livesearch** — встроенный поиск по страницам портала:
    {"type": "macro", "macroName": "livesearch", "macroProps": {}}

15. **properties** — свойства страницы (метаданные для отчётов):
    {"type": "macro", "macroName": "properties", "macroProps": {"properties": {"Владелец": "Иван", "Отдел": "Разработка", "Статус": "Активна"}}}

16. **properties_report** — сводная таблица свойств нескольких страниц:
    {"type": "macro", "macroName": "properties_report", "macroProps": {}}

17. **comments** — блок комментариев к странице:
    {"type": "macro", "macroName": "comments", "macroProps": {}}

18. **jira_issues** — список задач из Jira:
    {"type": "macro", "macroName": "jira_issues", "macroProps": {"jiraUrl": "https://company.atlassian.net", "jql": "project = PROJ AND sprint = ongoing"}}

19. **github_issues** — список проблем из GitHub:
    {"type": "macro", "macroName": "github_issues", "macroProps": {"repo": "owner/repo", "state": "open", "labels": "bug"}}

20. **notifications** — блок уведомлений/оповещений:
    {"type": "macro", "macroName": "notifications", "macroProps": {}}

## ВАЖНО — как использовать макросы:

1. Используй **panel/info/tip/note/warning** для примечаний, предупреждений, подсказок
2. Используй **status** после заголовков задач/проектов для обозначения состояния
3. Используй **expand** для FAQ, длинных инструкций, скрытых деталей
4. Используй **decision** для фиксации ключевых решений на странице
5. Для списка участников/команды ставь **status** рядом с именем
6. Используй **quote** для цитат, важных выдержек из документов
7. Используй **divider** между крупными разделами
8. Используй **toc** после заголовка страницы для навигации
9. Комбинируй блоки: heading → text → table → status → expand и т.д.
10. Страница должна выглядеть как профессиональная Confluence-страница
11. Используй **livesearch** для быстрого доступа к поиску внизу страниц
12. Используй **properties** для метаданных страницы (владелец, отдел, статус)
13. Используй **properties_report** для отчётов по нескольким страницам
14. Используй **jira_issues** если речь о задачах Jira
15. Используй **github_issues** если речь об issue GitHub

## Правила:
- Минимум 8-15 блоков контента для полноценной страницы
- Генерируй РЕАЛИСТИЧНЫЙ контент — конкретные имена, числа, даты, задачи
- Обязательно используй макросы — минимум 3-5 макросов на страницу
- Для командных страниц: добавь status к каждому участнику/задаче
- Для планов/roadmap: используй progress, calendar, decision
- Для FAQ: используй expand для каждого вопроса
- Для документации: используй info/tip/warning для примечаний
- Отвечай НА РУССКОМ языке
- Ответ — ВАЛИДНЫЙ JSON, без markdown-обёрток

НЕ оборачивай ответ в backtick-блоки — только чистый JSON.`;
const AI_PROVIDER_MODELS = {
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
};
exports.AI_PROVIDER_MODELS = AI_PROVIDER_MODELS;
class AIService {
    async build(data, user) {
        let provider = 'openrouter';
        let apiKey = config_1.OPENROUTER_KEY;
        let model = 'qwen/qwen3.6-plus:free';
        let temperature = 0.7;
        let maxTokens = 4000;
        try {
            const settings = await usersRepo.getAISettings(user.id);
            if (settings) {
                provider = settings.provider || provider;
                apiKey = settings.api_key || apiKey;
                model = settings.model || model;
                temperature = parseFloat(settings.temperature || String(temperature));
                maxTokens = settings.max_tokens || maxTokens;
            }
        }
        catch (e) {
            logger_1.logger.warn({ msg: 'AI build: falling back to env settings', error: e.message });
        }
        if (!apiKey) {
            return { error: 'AI API key not configured. Go to Settings → AI to set your API key.', status: 503 };
        }
        const freeFallbackModels = ['qwen/qwen3.6-plus:free', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.1-8b-instruct:free'];
        const modelsToTry = [model, ...freeFallbackModels.filter(m => m !== model)];
        let lastError = '';
        const userPrompt = data.prompt;
        for (const mdl of modelsToTry) {
            try {
                const reqBody = {
                    model: mdl,
                    messages: [
                        { role: 'system', content: AI_SYSTEM_PROMPT },
                        { role: 'user', content: data.prompt }
                    ],
                    temperature,
                    max_tokens: maxTokens
                };
                let response;
                for (let attempt = 0; attempt < 3; attempt++) {
                    if (attempt > 0) {
                        const delay = attempt * 3000;
                        logger_1.logger.info({ msg: `AI retry ${attempt}/3 for ${mdl}`, delay });
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
                        logger_1.logger.warn({ msg: `AI 429 on ${mdl}`, waitMs });
                        await new Promise(r => setTimeout(r, waitMs));
                        continue;
                    }
                    if (!response.ok) {
                        const errText = await response.text();
                        logger_1.logger.error({ msg: `AI error (${mdl})`, status: response.status, errText });
                        lastError = `AI API error: ${response.status}`;
                        break;
                    }
                    const responseData = await response.json();
                    let rawContent = responseData.choices?.[0]?.message?.content || '';
                    rawContent = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
                    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        lastError = 'AI returned non-JSON response';
                        break;
                    }
                    const spec = JSON.parse(jsonMatch[0]);
                    if (!spec.title)
                        spec.title = userPrompt.slice(0, 60);
                    if (!spec.content || !Array.isArray(spec.content)) {
                        spec.content = [
                            { type: 'heading', text: spec.title },
                            { type: 'text', text: rawContent.slice(0, 500) }
                        ];
                    }
                    logger_1.logger.info({ msg: `AI build success`, model: mdl });
                    return spec;
                }
            }
            catch (e) {
                logger_1.logger.error({ msg: `AI build error on ${mdl}`, error: e.message });
                lastError = e.message;
            }
        }
        logger_1.logger.error({ msg: 'All AI models failed', lastError });
        return { error: 'AI генерация недоступна (rate limit). Попробуйте через минуту.', hint: lastError, status: 502 };
    }
    async getSettings(userId) {
        const result = await config_1.pool.query('SELECT provider, model, temperature, max_tokens, updated_at FROM ai_settings WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            return {
                provider: 'openrouter',
                model: 'qwen/qwen3.6-plus:free',
                temperature: 0.7,
                maxTokens: 4000,
                availableModels: AI_PROVIDER_MODELS.openrouter,
            };
        }
        const row = result.rows[0];
        const availableModels = AI_PROVIDER_MODELS[row.provider] || AI_PROVIDER_MODELS.openrouter;
        return {
            provider: row.provider,
            model: row.model,
            temperature: parseFloat(row.temperature),
            maxTokens: row.max_tokens,
            hasApiKey: !!(row.api_key && row.api_key.length > 0),
            availableModels,
        };
    }
    async updateSettings(data) {
        const result = await usersRepo.upsertAISettings({ userId: data.userId, provider: data.provider, apiKey: data.apiKey, model: data.model, temperature: data.temperature, maxTokens: data.maxTokens });
        const availableModels = AI_PROVIDER_MODELS[result.provider] || AI_PROVIDER_MODELS.openrouter;
        return {
            provider: result.provider,
            model: result.model,
            temperature: parseFloat(result.temperature),
            maxTokens: result.max_tokens,
            hasApiKey: !!(data.apiKey && data.apiKey.length > 0),
            availableModels,
        };
    }
    getProviders() {
        return AI_PROVIDER_MODELS;
    }
    async testConnection(userId) {
        const settingsResult = await config_1.pool.query('SELECT provider, api_key, model, temperature, max_tokens FROM ai_settings WHERE user_id = $1', [userId]);
        const settings = settingsResult.rows[0] || {};
        const provider = settings.provider || 'openrouter';
        const apiKey = settings.api_key || process.env.OPENROUTER_API_KEY;
        const model = settings.model || 'qwen/qwen3.6-plus:free';
        const temperature = parseFloat(settings.temperature || '0.7');
        const maxTokens = settings.max_tokens || 4000;
        if (!apiKey) {
            return { error: 'No API key configured. Please set your API key in AI Settings.', status: 400 };
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
        }
        else if (provider === 'openai') {
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
        }
        else if (provider === 'anthropic') {
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
        }
        else {
            return { error: `Provider '${provider}' test not implemented yet.`, status: 400 };
        }
        if (!testResponse.ok) {
            const errText = await testResponse.text();
            return { error: `Provider API error (${testResponse.status}): ${errText.slice(0, 200)}`, status: 400 };
        }
        const data = await testResponse.json();
        return { success: true, message: 'Connection successful', model: data.model || model };
    }
}
exports.AIService = AIService;
//# sourceMappingURL=aiService.js.map