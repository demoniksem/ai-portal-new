# Рекомендации Архитектора — AI Portal

**Дата:** 2026-04-03  
**Выполнил:** Архитектор проекта

---

## Выполненные задачи

### 1. Архитектурный анализ ✅

Прочитан и проанализирован текущий код проекта:

- **Backend:** monolithic Express.js приложение (440 LOC в одном файле `index.js`)
- **Frontend:** Next.js 16 Page Router с 4 страницами
- **Data Layer:** PostgreSQL 15, Redis 7 (не используется), Meilisearch
- **Docker:** базовый docker-compose.yml без healthchecks и изоляции

### 2. Технический документ ✅

Создан `/docs/ARCHITECTURE.md` (630 строк), включает:

- **Мермерmaid-диаграмма** текущей архитектуры
- **Таблица API endpoints** (11 endpoints)
- **23 проблемы и риска** по приоритету (P0–P2)
- **Рекомендуемая модульная структура** backend (11 директорий)
- **Roadmap фаз:** MVP → Phase 2 (~10 дней) → Production
- **Сравнение фреймворков:** Express (stay) vs Fastify vs NestJS
- **Аргументация за TypeScript** в Phase 2
- **Стратегия OpenClaw интеграции** (HTTP API Gateway)
- **Готовый промпт** для AI-агента генерации PageSpec
- **Чек-лист перед релизом** (11 пунктов)

### 3. Оптимизация Docker ✅

Обновлённые файлы:

#### `docker-compose.yml`
- ✅ Healthchecks для всех 5 сервисов (postgres, redis, meilisearch, backend, frontend)
- ✅ Restart policies: `unless-stopped`
- ✅ Две сети: `backend-network` (БД, Redis, Meilisearch, backend) и `frontend-network` (backend, frontend)
- ✅ Log rotation: json-file driver, max 10MB × 3 файла
- ✅ Порты БД ограничены `127.0.0.1` (недоступны извне)
- ✅ `depends_on` с `condition: service_healthy`

#### `backend/Dockerfile`
- ✅ Multi-stage build (3 стадии: deps, builder, runner)
- ✅ Production-only dependencies
- ✅ Non-root user (`nodejs:nodejs`, UID 1001)
- ✅ `.dockerignore` для исключения `node_modules`

#### `frontend/Dockerfile`
- ✅ Multi-stage build (deps, builder, runner)
- ✅ Non-root user
- ✅ `wget` для healthcheck

#### `.dockerignore` (корень проекта)
- ✅ Исключены `node_modules`, `.next`, dev-файлы

#### `.env.example`
- ✅ Шаблон с безопасными плейсхолдерами
- ✅ Инструкция генерации JWT_SECRET

### 4. Healthcheck endpoint ✅

Добавлен в `backend/src/index.js`:

```javascript
GET /api/health
```

Возвращает статус всех зависимостей (postgres, redis, meilisearch) и uptime.

### 5. Стратегия OpenClaw интеграции ✅

**Рекомендация:** HTTP API OpenClaw Gateway

**Настройка:**
1. На хосте: `openclaw gateway start --listen 0.0.0.0:18789`
2. В `.env`: `OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789`
3. В `docker-compose.yml`: `extra_hosts: - "host.docker.internal:host-gateway"` (добавить при использовании HTTP API)

**Альтернативы:**
- Exec через host bridge — не рекомендуется (breaks isolation)
- Webhook/Callback — для Phase 3 (асинхронная генерация с queue)

---

## Приоритетные действия (P0)

```bash
# 1. Сгенерируйте JWT_SECRET
openssl rand -hex 32
# Вставьте в .env

# 2. Запустите OpenClaw Gateway
openclaw gateway start --listen 0.0.0.0:18789

# 3. Пересоберите и запустите
docker compose down -v
docker compose up -d --build

# 4. Проверьте health
curl http://localhost:3001/api/health
```

---

## Следующие шаги

### Phase 2 (1-2 месяца, ~10 дней)

1. **Рефакторинг backend** на модульную структуру (2 дня)
2. **Redis кэширование** страниц (1 день)
3. **Rate limiting** для auth/AI endpoints (0.5 дня)
4. **Валидация ввода** с Zod (1 день)
5. **OpenClaw HTTP API интеграция** (2 дня)
6. **ACL enforcement** middleware (2 дня)
7. **TypeScript миграция** (2 дня)

### Phase 3: Production (3-6 месяцев)

- API Gateway (Traefik)
- HTTPS через Let's Encrypt
- Микросервис AI Worker с BullMQ queue
- OAuth 2.0 / SSO
- CI/CD + E2E тесты
- Prometheus + Grafana мониторинг

---

## Файлы созданы/обновлены

| Файл | Статус | Описание |
|------|--------|----------|
| `docs/ARCHITECTURE.md` | Создан | Полная техническая документация (630 строк) |
| `docker-compose.yml` | Обновлён | Healthchecks, сети, restart policies, log rotation |
| `backend/Dockerfile` | Обновлён | Multi-stage, non-root user |
| `frontend/Dockerfile` | Обновлён | Multi-stage, non-root user |
| `.dockerignore` | Создан | Исключение node_modules |
| `.env.example` | Создан | Шаблон переменных окружения |
| `backend/src/index.js` | Обновлён | Добавлен `/api/health` endpoint |
| `README.md` | Создан | Инструкция по запуску |

---

*Все файлы закоммичены в рабочий каталог. Готово к тестированию.*
