# AI Portal — Архитектурная документация

**Версия:** 0.1.0  
**Дата:** 2026-04-03  
**Автор:** Архитектор проекта

---

## 1. Текущая архитектура

### 1.1. Обзор компонентов

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI Portal Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐              ┌──────────────────────┐             │
│  │   Frontend   │  HTTP/JSON   │      Backend         │             │
│  │ Next.js 16   │──────────────│   Express.js :3001   │             │
│  │  Page Router │              │  (monolith)          │             │
│  └──────────────┘              └──────────┬───────────┘             │
│                                          │                          │
│  ┌──────────┐   ┌──────────┐   ┌─────────▼──────────┐             │
│  │PostgreSQL│   │  Redis   │   │   Meilisearch      │             │
│  │   :5432  │   │  :6379   │   │      :7700         │             │
│  └──────────┘   └──────────┘   └────────────────────┘             │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2. Mermaid-диаграмма

```mermaid
graph TB
    subgraph Frontend
        FE[Next.js 16<br/>Port 3000<br/>Page Router]
    end

    subgraph Backend
        BE[Express.js Monolith<br/>Port 3001<br/>src/index.js - 440+ LOC]
    end

    subgraph Data Layer
        PG[(PostgreSQL 15<br/>:5432)]
        RD[(Redis 7<br/>:6379)]
        MS[(Meilisearch<br/>:7700)]
    end

    subgraph External
        OC[OpenClaw Gateway<br/>Port 18789<br/>(exec - не работает из контейнера)]
    end

    FE -->|HTTP /api/*| BE
    BE -->|SQL| PG
    BE -->|Caching*| RD
    BE -->|Search Index| MS
    BE -.->|exec openclaw chat| OC

    style BE fill:#ffeb3b
    style RD fill:#e0e0e0
    style OC fill:#ffcdd2
```

### 1.3. API Endpoints

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | `/api/auth/register` | — | Регистрация пользователя |
| POST | `/api/auth/login` | — | Логин, возврат JWT |
| GET | `/api/spaces` | JWT | Список всех пространств |
| POST | `/api/spaces` | JWT | Создание пространства |
| GET | `/api/pages` | JWT | Список страниц (опц. ?spaceId) |
| GET | `/api/pages/:id` | JWT | Получить страницу по ID |
| POST | `/api/pages` | JWT | Создать страницу |
| PATCH | `/api/pages/:id` | JWT | Обновить страницу |
| DELETE | `/api/pages/:id` | JWT | Удалить страницу |
| GET | `/api/search` | JWT | Поиск по Meilisearch |
| POST | `/api/ai/build` | JWT | AI-генерация PageSpec |

### 1.4. Структура БД

```sql
-- users: id, email, password_hash, username, created_at
-- spaces: id, name, slug, created_by (FK->users), created_at
-- pages: id, space_id (FK->spaces), title, content (JSONB), acl (JSONB), created_by (FK->users), created_at
```

### 1.5. Файловая структура проекта

```
ai-portal/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── init.sql
│   └── src/
│       └── index.js          # ~440 строк — весь backend в одном файле
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── pages/
│       │   ├── _app.js
│       │   ├── index.js          # Главная с AI-генерацией
│       │   ├── login.js          # Логин
│       │   └── spaces/
│       │       └── index.js      # Список страниц
│       └── styles/
└── shared/
    └── pages.schema.json
```

---

## 2. Проблемы и риски

### 2.1. Критические (P0)

| # | Проблема | Сложность исправления |
|---|----------|----------------------|
| 1 | **Monolithic backend** — вся логика (440 строк) в одном файле `index.js`. Нет модульности, нет разделения ответственности. | Низкая |
| 2 | **Безопасность: JWT_SECRET захардкожен** в docker-compose как `supersecret`. Ключи не ротируемые. | Низкая |
| 3 | **Безопасность: default admin credentials** — `admin@portal.com / admin123` создаётся при каждом деплое. | Низкая |
| 4 | **Нет валидации ввода** — кроме базовых проверок `if (!email)`, нет middleware для sanitization, rate limiting, input schema. | Средняя |
| 5 | **Открытые порты БД наружу** — PostgreSQL:5432, Redis:6379, Meilisearch:7700 опубликованы на host. | Низкая |
| 6 | **OpenClaw exec не работает из контейнера** — `/api/ai/build` падает в fallback-режим без реальной генерации. | Средняя |

### 2.2. Высокие (P1)

| # | Проблема | Описание |
|---|----------|----------|
| 7 | **Redis не используется** — клиент создаётся, подключается, но не применяется ни для кэширования, ни для сессий. |
| 8 | **Нет healthchecks** — `depends_on` в Docker Compose ждёт только старта контейнера, не готовности сервиса. |
| 9 | **Нет .dockerignore** — `node_modules`, `package-lock.json` копируются в образ, увеличивая размер. |
| 10 | **Нет логирования и мониторинга** — только `console.log` / `console.error`. Нет structured logs, нет tracing. |
| 11 | **Нет ACL enforcement** — поле `acl` существует в БД, но не проверяется в endpoints. |
| 12 | **Frontend: CSS modules без файлов** — `import styles from '../styles/Home.module.css'`, но файлы стилей не найдены в проекте. |

### 2.3. Средние (P2)

| # | Проблема | Описание |
|---|----------|----------|
| 13 | **Нет пагинации** — `/api/pages` и `/api/spaces` отдают все записи без limit/offset. |
| 14 | **Нет soft delete** — `DELETE FROM pages` удаляет физически, нет архива. |
| 15 | **Нет WebSocket/SSE** — нет real-time обновлений при совместной работе. |
| 16 | **Frontend без TypeScript** — нет типизации, нет compile-time проверок API-ответов. |
| 17 | **Нет тестов** — ни unit, ни integration, ни E2E. |

---

## 3. Рекомендуемые улучшения

### 3.1. Архитектурные

#### 3.1.1. Фаза 1: Рефакторинг monolithic backend

```
backend/src/
├── index.js              # Точка входа, инициализация Express
├── config/
│   ├── database.js       # Пул-коннектор к PostgreSQL
│   ├── redis.js          # Redis клиент
│   ├── meilisearch.js    # Meilisearch клиент
│   └── auth.js           # JWT конфигурация
├── middleware/
│   ├── auth.js           # JWT-verify middleware
│   ├── validation.js     # Zod/Joi валидация
│   └── rateLimiter.js    # Rate limiting
├── routes/
│   ├── auth.routes.js    # /api/auth/*
│   ├── pages.routes.js   # /api/pages/*
│   ├── spaces.routes.js  # /api/spaces/*
│   ├── search.routes.js  # /api/search
│   └── ai.routes.js      # /api/ai/build
├── services/
│   ├── auth.service.js   # Логика регистрации/логина
│   ├── pages.service.js  # CRUD страниц
│   ├── spaces.service.js # CRUD пространств
│   ├── search.service.js # Индексация/поиск
│   └── ai.service.js     # Интеграция с OpenClaw
├── repositories/
│   ├── users.repo.js     # SQL-запросы к users
│   ├── pages.repo.js     # SQL-запросы к pages
│   └── spaces.repo.js    # SQL-запросы к spaces
└── utils/
    ├── logger.js         # Pino/winston structured logging
    └── errors.js         # Централизованная обработка ошибок
```

**Выгоды:**
- Разделение ответственности (Single Responsibility)
- Упрощённое тестирование (mock сервисов отдельно)
- Легче онбординг новых разработчиков
- Возможность заменить отдельные компоненты

#### 3.1.2. Фаза 2: API Gateway + микросервисы (при росте нагрузки)

```
                    ┌─────────────────┐
                    │  API Gateway     │
                    │  (Kong/Traefik)  │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼─────┐      ┌─────▼─────┐      ┌──────▼──────┐
    │ Auth Svc │      │Pages Svc  │      │  AI Worker   │
    │  JWT +   │      │ CRUD +    │      │ (OpenClaw    │
    │  OAuth   │      │ Meilis    │      │  integration)│
    └────┬─────┘      └────┬──────┘      └──────┬───────┘
         │                  │                    │
         └──────────────────┼────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  PostgreSQL    │
                    │  Redis Cache   │
                    │  Meilisearch   │
                    └────────────────┘
```

**Когда нужно:**
- При 1000+ RPS
- При независимом масштабировании AI-воркеров (ресурсоёмкие задачи)
- При добавлении OAuth/SAML

#### 3.1.3. Кэширование с Redis

```javascript
// Пример: кэширование страниц
app.get('/api/pages/:id', authMiddleware, async (req, res) => {
  const cacheKey = `page:${req.params.id}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const page = await pagesService.getById(req.params.id);
  await redisClient.setEx(cacheKey, 300, JSON.stringify(page)); // TTL 5 мин
  res.json(page);
});

// Инвалидация при обновлении
await redisClient.del(`page:${pageId}`);
```

#### 3.1.4. Rate Limiting

```javascript
// express-rate-limit для публичных endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 мин
  max: 100 // запросов
});
app.use('/api/auth/', limiter); // защита от brute-force
app.use('/api/ai/build', rateLimit({ max: 10 })); // AI - дорогой
```

### 3.2. Безопасность

| Действие | Приоритет |
|----------|-----------|
| Вынести `JWT_SECRET` в `.env` с `openssl rand -hex 32` | P0 |
| Убрать публикацию портов БД на host (`127.0.0.1:5432` или только internal network) | P0 |
| Запретить создание admin с дефолтным паролем в production | P0 |
| Добавить HTTPS (Let's Encrypt / nginx reverse proxy) | P1 |
| Добавить CORS-заголовки с явным allowed origins | P1 |
| Валидация и sanitization всего ввода (Zod/Joi) | P1 |
| Реализовать ACL-проверки в middleware | P1 |
| Hash JWT в cookies вместо localStorage (CSRF + XSS защита) | P2 |

### 3.3. Мониторинг и логирование

```javascript
// pino + pino-pretty для structured logging
const logger = require('pino')();
logger.info({ userId: req.user.id }, 'Page created', { pageId });
```

**Infrastructure:**
- Healthchecks: `GET /health` → статус БД, Redis, Meilisearch
- Metrics: Prometheus + Grafana (RPS, latency, error rate)
- Alerts: Slack/Telegram webhook при 5xx > 1% за 5 мин

---

## 4. Roadmap архитектурных фаз

### MVP (текущее состояние)

- [x] CRUD страниц и пространств
- [x] JWT-аутентификация
- [x] Поиск через Meilisearch
- [ ] AI-генерация (заблокировано интеграцией OpenClaw)
- [ ] Базовый фронтенд (в работе)

**Критические фиксы перед продакшеном:**
1. Вынести JWT_SECRET в переменные окружения
2. Закрыть порты БД от внешнего доступа
3. Исправить OpenClaw интеграцию
4. Добавить healthchecks

### Phase 2 (через 1-2 месяца)

| Задача | Оценка |
|--------|--------|
| Рефакторинг backend (модульная структура) | 2 дня |
| Redis кэширование для страниц | 1 день |
| Rate limiting для auth и AI endpoints | 0.5 дня |
| Валидация ввода (Zod) | 1 день |
| Healthcheck endpoint | 0.5 дня |
| Structured logging (pino) | 0.5 дня |
| ACL enforcement | 2 дня |
| Интеграция OpenClaw через HTTP API | 2 дня |

**Итого:** ~10 рабочих дней

### Phase 3: Production (через 3-6 месяцев)

| Задача | Описание |
|--------|----------|
| API Gateway (Traefik/Kong) | Rate limiting, auth offload, routing |
| HTTPS (Let's Encrypt) | Автоматические сертификаты |
| Микросервис AI Worker | Выделенный сервис с retry/queue для OpenClaw |
| Queue (BullMQ + Redis) | Асинхронная обработка AI-задач |
| OAuth 2.0 / SSO | Интеграция с корпоративным IdP |
| E2E тесты (Playwright) | Покрытие ключевых сценариев |
| CI/CD (GitHub Actions) | Тесты → build → deploy |
| Мониторинг (Prometheus + Grafana) | Метрики, алерты, дашборды |

---

## 5. Выбор стека для Phase 2

### 5.1. Express vs Fastify vs NestJS

| Критерий | Express | Fastify | NestJS |
|----------|---------|---------|--------|
| **Текущий стек** | ✅ Уже используется | Требуется миграция | Требуется полный рефакторинг |
| **Производительность** | Средняя | Высокая (2x Express) | Средняя (overhead декораторов) |
| **Размер команды** | — | — | Лучше для больших команд |
| **TypeScript** | Опционально | Опционально | Обязателен |
| **Время миграции** | 0 | 2-3 дня | 1-2 недели |
| **Зрелость экосистемы** | Огромная | Хорошая | Хорошая |
| **Обучающая кривая** | Низкая | Низкая | Высокая |

**Рекомендация: Остаться на Express для Phase 2**

**Обоснование:**
- MVP готов, миграция на другой фреймворк блокирует фичи
- Fastify даёт 2x performance, но bottleneck сейчас — БД и AI, не Express
- NestJS оверкил для текущего размера команды (1 разработчик?)
- Рефакторинг на модульную структуру можно сделать поверх Express
- **Миграция на Fastify** имеет смысл при 500+ RPS (измерить перед решением)

### 5.2. Добавить TypeScript?

**Да, обязательно для Phase 2.**

| Аргумент | Пояснение |
|----------|-----------|
| **Type-safety API** | Frontend и Backend будут иметь общую типизацию (`shared/types/`) |
| **Refactoring** | При модульном рефакторинге TS ловит ошибки до рантайма |
| **DX** | Autocomplete в IDE, меньше багов на production |
| **Стоимость** | +1-2 дня на настройку TS-config, миграцию типов |

**Миграционный план:**
```
1. Добавить tsconfig.json, @types/*
2. Переименовать index.js → index.ts
3. По модулю: routes → services → repositories
4. Shared types: shared/types/pages.ts, shared/types/auth.ts
5. Frontend: постепенно перевести страницы на TypeScript
```

---

## 6. Оптимизация Docker

### 6.1. Текущие проблемы

1. **Нет .dockerignore** — `node_modules` копируются в образ, увеличивая размер на 100-200MB
2. **Backend Dockerfile** — устанавливает devDependencies в production-образе
3. **Frontend Dockerfile** — `npm install --production` ставит только runtime deps, но Next.js не собран в builder-стагии
4. **Нет healthchecks** — Docker не знает, готов ли сервис
5. **Нет restart policies** — контейнеры не перезапускаются при краше
6. **Нет изоляции сетей** — frontend может ходить напрямую в БД
7. **Нет log rotation** — логи растут бесконечно

### 6.2. Рекомендации

Смотри обновлённый `docker-compose.yml` и Dockerfiles ниже.

#### Backend Dockerfile (multi-stage)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/init.sql ./init.sql

ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["node", "src/index.js"]
```

#### Frontend Dockerfile (multi-stage)

Уже есть multi-stage, но можно улучшить:
- Использовать `npm ci --frozen-lockfile` для детерминированных билдов
- `.next/standalone` для минимального образа (Next.js 12+)

#### .dockerignore

```
# Backend
node_modules
npm-debug.log
.env
.dockerignore
Dockerfile

# Frontend  
node_modules
.next
.env
*.md
```

---

## 7. Стратегия OpenClaw интеграции

### 7.1. Проблема

Текущий `/api/ai/build` пытается выполнить `openclaw chat --model ...` через `exec()`, что **не работает из Docker-контейнера** backend, так как:
- `openclaw` CLI не установлен в образе backend
- Нет сетевого доступа к OpenClaw gateway (port 18789)
- exec внутри контейнера изолирован от host

### 7.2. Варианты интеграции

#### Вариант А: HTTP API OpenClaw Gateway (рекомендуемый)

**Механика:**
- OpenClaw Gateway слушает `http://<host-ip>:18789`
- Backend делает `POST /api/chat` с промптом
- Gateway возвращает ответ от LLM

```javascript
// backend/src/services/ai.service.js
const axios = require('axios');

const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL || 'http://host.docker.internal:18789';

async function generatePageSpec(prompt) {
  const { data } = await axios.post(`${OPENCLAW_GATEWAY}/api/chat`, {
    model: 'openrouter/qwen/qwen3.6-plus:free',
    messages: [
      {
        role: 'system',
        content: getPageSpecSystemPrompt()
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    maxTokens: 1000
  });
  
  // Parse JSON from LLM response
  return parsePageSpec(data.content);
}
```

**Плюсы:**
- Чёткий контракт (HTTP/JSON)
- LLM-запросы не блокируют backend (можно сделать асинхронным через queue)
- Gateway управляет rate limiting, fallback-моделями

**Минусы:**
- Нужно настроить OpenClaw Gateway для прослушивания на `0.0.0.0`
- `host.docker.internal` работает на Docker Desktop, но на Linux requires `--add-host=host.docker.internal:host-gateway`

#### Вариант Б: Exec через host bridge (не рекомендуется)

**Механика:**
- Монтировать OpenClaw CLI внутрь контейнера
- Использовать `host` network mode для backend

**Минусы:**
- Breaking network isolation
- CLI может быть нестабильным (stderr, кодировка)
- Hard to debug

#### Вариант В: Webhook/Callback (для асинхронной генерации)

**Механика:**
- Backend создаёт задачу: `POST /api/ai/build` → `202 Accepted` с `taskId`
- Task кладётся в Redis queue (BullMQ)
- Worker вне Docker (или отдельный контейнер с OpenClaw CLI) берёт задачу
- Worker генерирует PageSpec, кладёт результат в Redis
- Frontend polling `GET /api/ai/status/:taskId`

**Плюсы:**
- Не блокирует запрос (важно для долгих генераций >30 сек)
- Можно масштабировать воркеры отдельно

**Минусы:**
- Больше инфраструктуры (очередь, polling endpoint)
- Overkill для MVP

### 7.3. Рекомендация

**Для Phase 2: Вариант А (HTTP API Gateway)**

**Настройка:**
1. На host-машине: `openclaw gateway start --listen 0.0.0.0:18789`
2. В `docker-compose.yml`:
```yaml
backend:
  extra_hosts:
    - "host.docker.internal:host-gateway"
  environment:
    OPENCLAW_GATEWAY_URL: http://host.docker.internal:18789
```

### 7.4. Промпт для AI-агента генерации PageSpec

```
Ты — генератор спецификаций страниц для AI Portal.

Входные данные:
- Пользовательский промпт: "{{userPrompt}}"

Задача: Сгенерируй валидный PageSpec JSON, описывающий структуру страницы.

Формат PageSpec:
{
  "title": "Заголовок страницы (string, max 255 символов)",
  "spaceId": 1, // ID пространства (integer)
  "content": [
    {
      "type": "heading",
      "text": "Заголовок раздела"
    },
    {
      "type": "text",
      "text": "Текстовый блок с описанием"
    },
    {
      "type": "table",
      "headers": ["Колонка 1", "Колонка 2"],
      "rows": [
        ["Значение 1", "Значение 2"],
        ["Значение 3", "Значение 4"]
      ]
    },
    {
      "type": "macro",
      "macroName": "название макроса",
      "macroProps": {"key": "value"}
    }
  ],
  "acl": {
    "readers": ["@all"],
    "editors": ["@admins"]
  }
}

Правила:
1. Верни ТОЛЬКО валидный JSON, без пояснений.
2. Разделы (heading + текст) логически связаны с промптом.
3. Используй таблицы, когда промпт подразумевает структурированные данные.
4. Макросы используй только для известных типов: calendar, kanban, chart.
5. Если промпт неясный, создай generic структуру с секциями: Обзор, Задачи, Команда.
6. ACL всегда включайте: readers ["@all"], editors ["@admins"].
7. spaceId всегда 1 (будет переопределено при сохранении).

Пример промпта: "Создай страницу команды с разделами: цели, участники, KPI"

Пример ответа:
{
  "title": "Команда",
  "spaceId": 1,
  "content": [
    {"type": "heading", "text": "Цели команды"},
    {"type": "text", "text": "Описание основных целей..."},
    {"type": "heading", "text": "Участники"},
    {"type": "table", "headers": ["Имя", "Роль", "KPI"], "rows": [["Алиса", "PM", "95%"]]},
    {"type": "heading", "text": "KPI"},
    {"type": "text", "text": "Метрики эффективности команды..."}
  ],
  "acl": {"readers": ["@all"], "editors": ["@admins"]}
}
```

---

## 8. Чек-лист перед релизом

- [ ] JWT_SECRET вынесен в `.env` и сгенерирован случайно
- [ ] Порты БД не опубликованы наружу (только internal Docker network)
- [ ] Healthchecks добавлены во все сервисы
- [ ] Restart policies: `restart: unless-stopped`
- [ ] OpenClaw Gateway доступен из backend-контейнера
- [ ] Rate limiting на `/api/auth/login` и `/api/ai/build`
- [ ] Валидация ввода на всех endpoints
- [ ] ACL middleware проверяет доступы перед чтением/записью страниц
- [ ] Логи структурированы (pino)
- [ ] Frontend CSS-файлы существуют и подключены
- [ ] Пагинация на `/api/pages` и `/api/spaces`

---

*Документ будет обновляться по мере развития проекта.*
