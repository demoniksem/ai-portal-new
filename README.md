# AI Portal

Пилотный проект — портал для управления страницами с AI-генерацией через OpenClaw.

## Быстрый старт

### 1. Настройка

```bash
# Скопируйте переменные окружения
cp .env.example .env

# Сгенерируйте JWT_SECRET
openssl rand -hex 32 >> .env  # замените JWT_SECRET в .env на это значение

# Настройте OpenClaw Gateway
# На хост-машине: openclaw gateway start --listen 0.0.0.0:18789
```

### 2. Запуск

```bash
docker compose up -d --build
```

Сервисы:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Meilisearch: http://127.0.0.1:7700 (только локально)
- PostgreSQL: 127.0.0.1:5432 (только локально)
- Redis: 127.0.0.1:6379 (только локально)

### 3. Первый вход

Дефолтный админ (создаётся при старте):
- Email: `admin@portal.com`
- Пароль: `admin123`

**⚠️ Смените пароль после первого входа!**

### 4. Проверка health

```bash
curl http://localhost:3001/api/health
```

Ответ:
```json
{
  "status": "healthy",
  "checks": {
    "postgres": true,
    "redis": true,
    "meilisearch": true,
    "uptime": 123.45
  }
}
```

## Структура проекта

```
ai-portal/
├── docker-compose.yml      # Оркестрация сервисов
├── .env.example            # Шаблон переменных окружения
├── docs/
│   └── ARCHITECTURE.md     # Техническая документация
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   └── index.js        # Express backend
│   └── package.json
├── frontend/
│   ├── Dockerfile
│   ├── src/pages/          # Next.js страницы
│   └── package.json
└── shared/
    └── pages.schema.json   # Схема PageSpec
```

## Docker

### Оптимизации

- **Multi-stage builds** — backend и frontend собираются в несколько стадий, итоговый образ содержит только production-зависимости
- **.dockerignore** — `node_modules` и dev-файлы исключены из сборки
- **Healthchecks** — все сервисы имеют healthchecks, `depends_on` ждёт готовности, а не старта
- **Restart policies** — `unless-stopped` для автоматического восстановления
- **Log rotation** — JSON logs с ограничением 10MB × 3 файла
- **Network isolation** — `backend-network` (БД, Redis, Meilisearch) отделена от `frontend-network`
- **Non-root** — backend и frontend запускаются от `nodejs` (UID 1001)

### Команды

```bash
# Построить и запустить
docker compose up -d --build

# Остановить
docker compose down

# Остановить с удалением volumes
docker compose down -v

# Просмотр логов
docker compose logs -f backend
docker compose logs -f frontend

# Перезапуск одного сервиса
docker compose restart backend
```

## OpenClaw Integration

AI-генерация (`/api/ai/build`) использует OpenClaw Gateway. 

Настройка:
1. На хост-машине: `openclaw gateway start --listen 0.0.0.0:18789`
2. В `.env`: `OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789`
3. Перезапуск: `docker compose up -d backend`

См. `docs/ARCHITECTURE.md` — раздел 7 для деталей.

## Разработка

### Backend dev

```bash
cd backend
npm install
npm run dev  # nodemon с авто-рестартом
```

### Frontend dev

```bash
cd frontend
npm install
npm run dev  # Next.js dev server :3000
```

## Документация

Полная архитектурная документация: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

Включает:
- Диаграммы текущей архитектуры
- Проблемы и риски
- Roadmap фаз (MVP → Phase 2 → Production)
- Рекомендации по стеку (Express vs Fastify vs NestJS, TypeScript)
- Стратегия OpenClaw интеграции

## Лицензия

MIT
