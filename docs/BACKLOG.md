# Feature Backlog — AI Portal

Дата: 2026-04-03
Версия: 1.0

---

## Легенда

| Статус | Описание |
|---|---|
| `planned` | Запланировано, не начато |
| `in_progress` | В разработке |
| `done` | Реализовано |
| `blocked` | Заблокировано (зависимости) |
| `deferred` | Отложено на будущие релизы |

| Приоритет | Описание |
|---|---|
| `P0` | Критично (Must have) |
| `P1` | Высокий (Should have) |
| `P2` | Средний (Could have) |
| `P3` | Низкий (Won't have) |

| Estimate | Описание |
|---|---|
| `XS` | < 1 дня |
| `S` | 1-2 дня |
| `M` | 3-5 дней |
| `L` | 1-2 недели |
| `XL` | 2+ недели |

---

## Модуль: Auth (Аутентификация и авторизация)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| AUTH-01 | Регистрация пользователя (email + password) | P0 | planned | M | Базовая регистрация с валидацией email |
| AUTH-02 | Вход в систему (login) | P0 | planned | S | JWT-токены, secure cookies |
| AUTH-03 | Сброс пароля | P1 | planned | M | Email с токеном сброса |
| AUTH-04 | Роли пользователей (Admin, Editor, Viewer) | P0 | planned | S | RBAC основа |
| AUTH-05 | Middleware защиты routes | P0 | planned | S | Защита API и UI routes |
| AUTH-06 | Logout и инвалидация токенов | P0 | planned | XS | |
| AUTH-07 | Session timeout | P1 | planned | XS | Автоматический выход после бездействия |
| AUTH-08 | SSO / OAuth интеграция | P2 | planned | L | Google, Microsoft, Okta |
| AUTH-09 | LDAP интеграция | P2 | planned | XL | Для enterprise-клиентов |
| AUTH-10 | 2FA (TOTP) | P2 | planned | M | Двухфакторная аутентификация |
| AUTH-11 | Audit log аутентификации | P1 | planned | S | Лог входов/выходов |

---

## Модуль: Spaces (Пространства)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| SP-01 | Создание пространства (имя, описание) | P0 | planned | S | |
| SP-02 | Список пространств (sidebar) | P0 | planned | S | Отображение доступных пространств |
| SP-03 | Редактирование пространства | P1 | planned | S | Изменение имени, описания |
| SP-04 | Удаление пространства | P0 | planned | S | С подтверждением |
| SP-05 | Архивация пространства | P1 | planned | XS | Скрыто из списка, доступно по прямой ссылке |
| SP-06 | AI-генерация пространства из промпта | P0 | planned | M | AI создаёт структуру + начальные страницы |
| SP-07 | Иконка/обложка пространства | P2 | planned | XS | Визуальная идентификация |
| SP-08 | Настройки доступа к пространству | P0 | planned | M | Public, private, restricted |
| SP-09 | Избранное пространство | P2 | planned | XS | Закрепление в sidebar |

---

## Модуль: Pages (Страницы)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| PG-01 | Создание пустой страницы | P0 | planned | S | Заголовок + пустой контент |
| PG-02 | Rich-text редактор | P0 | planned | M | TipTap / ProseMirror или аналог |
| PG-03 | Markdown поддержка | P0 | planned | S | Редактирование в Markdown |
| PG-04 | Предпросмотр страницы | P0 | planned | S | Rendered view |
| PG-05 | Иерархия страниц (дерево) | P0 | planned | M | Вложенность, drag-and-drop |
| PG-06 | Удаление страницы | P0 | planned | S | С подтверждением, soft delete |
| PG-07 | Восстановление удалённой страницы | P1 | planned | S | Корзина с retention policy |
| PG-08 | Загрузка вложений (изображения, файлы) | P0 | planned | M | Upload, хранение, отображение |
| PG-09 | Экспорт страницы (PDF) | P1 | planned | M | Генерация PDF |
| PG-10 | Экспорт страницы (Markdown) | P1 | planned | S | |
| PG-11 | Экспорт страницы (HTML) | P2 | planned | S | |
| PG-12 | Теги для страниц | P2 | planned | S | Множественные теги |
| PG-13 | Шаблоны страниц | P2 | planned | M | API doc, meeting notes, release notes |
| PG-14 | Embed контента (код, видео) | P2 | planned | M | Code blocks, YouTube, Mermaid диаграммы |
| PG-15 | Внутренние ссылки | P1 | planned | S | Wiki-style [[ссылки]] |
| PG-16 | breadcrumbs навигация | P1 | planned | S | Хлебные крошки |

---

## Модуль: AI (AI Generation)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| AI-01 | Генерация страницы из промпта | P0 | planned | M | Основной use case |
| AI-02 | Перегенерация с новым промптом | P0 | planned | S | |
| AI-03 | Редактирование AI-контента | P0 | planned | XS | Стандартный редактор после генерации |
| AI-04 | Контекст пространства при генерации | P1 | planned | M | AI учитывает другие страницы пространства |
| AI-05 | Draft mode для AI-контента | P1 | planned | S | Черновик до публикации |
| AI-06 | AI-поиск / Q&A по контенту | P2 | planned | L | RAG-based ответы на вопросы |
| AI-07 | AI-саммаризация страницы | P2 | planned | S | Краткое содержание |
| AI-08 | Выбор LLM-провайдера | P2 | planned | M | OpenAI, Anthropic, local model |
| AI-09 | Настройки AI (температура, max tokens) | P2 | planned | S | Advanced settings |
| AI-10 | История AI-запросов | P2 | planned | S | Лог промптов и ответов |
| AI-11 | Системный промпт (кастомизация) | P2 | planned | XS | Глобальный system prompt |
| AI-12 | AI-генерация заголовка из контента | P2 | planned | S | Автозаголовок |
| AI-13 | AI-улучшение существующего текста | P2 | planned | M | Rewrite, improve tone |

---

## Модуль: Search (Поиск)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| SR-01 | Полнотекстовый поиск | P0 | planned | M | PostgreSQL FTS или Elasticsearch |
| SR-02 | Поиск по пространствам (фильтр) | P1 | planned | S | |
| SR-03 | Автодополнение запроса | P1 | planned | M | Suggestions при вводе |
| SR-04 | Выделение совпадений | P1 | planned | S | Highlight в результатах |
| SR-05 | Поиск в реальном времени | P1 | planned | M | Debounced search-as-you-type |
| SR-06 | Сортировка результатов | P2 | planned | S | По релевантности, дате |
| SR-07 | Семантический AI-поиск | P2 | planned | L | Vector search, embeddings |
| SR-08 | Поиск по тегам | P2 | planned | S | |
| SR-09 | Сохранённые поиски | P3 | planned | XS | |
| SR-10 | Advanced search (filters) | P2 | planned | M | По дате, автору, пространству |

---

## Модуль: Permissions (Права доступа)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| PM-01 | Роли: Admin, Editor, Viewer | P0 | planned | S | |
| PM-02 | Права на пространство | P0 | planned | M | Public, private, restricted |
| PM-03 | Наследование прав (пространство → страница) | P1 | planned | S | |
| PM-04 | Индивидуальные права на страницу | P1 | planned | M | Override空间 permission |
| PM-05 | Группы пользователей | P1 | planned | M | Массовое управление правами |
| PM-06 | Guest access (внешние пользователи) | P2 | planned | M | Ограниченные права |
| PM-07 | Audit log прав доступа | P2 | planned | S | Кто изменил права и когда |
| PM-08 | Пригласительные ссылки | P2 | planned | M | Share с ограниченным доступом |

---

## Модуль: Versions (Версионирование)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| VS-01 | Автосохранение версий | P0 | planned | M | Каждая правка = новая версия |
| VS-02 | Просмотр истории версий | P1 | planned | S | Список с датой и автором |
| VS-03 | Diff между версиями | P1 | planned | M | Визуальное сравнение |
| VS-04 | Откат к версии | P0 | planned | S | Восстановление предыдущей версии |
| VS-05 | Комментарии к версии | P2 | planned | S | Автор описывает изменение |
| VS-06 | Отметка AI vs ручных правок | P2 | planned | S | Визуальное区分 |
| VS-07 | Retention policy | P2 | planned | S | Ограничение количества версий |

---

## Модуль: Admin (Администрирование)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| AD-01 | Панель администратора | P0 | planned | M | UI для управления |
| AD-02 | Управление пользователями | P0 | planned | S | Список, роли, блокировка |
| AD-03 | Настройки AI-провайдера | P0 | planned | S | API ключ, модель, endpoint |
| AD-04 | Audit log действий | P1 | planned | M | Кто что сделал |
| AD-05 | Бэкап данных (export) | P1 | planned | M | JSON/SQL dump |
| AD-06 | Восстановление из бэкапа (import) | P1 | planned | M | |
| AD-07 | Статистика использования | P2 | planned | M | Активные пользователи, популярные страницы |
| AD-08 | Настройки бренда | P2 | planned | S | Логотип, цвета, название |
| AD-09 | Health check endpoint | P1 | planned | XS | Для мониторинга |
| AD-10 | Environment configuration | P0 | planned | S | .env файл, Docker vars |

---

## Модуль: Integrations (Интеграции)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| IN-01 | REST API для чтения | P1 | planned | M | GET endpoints для страниц, пространств |
| IN-02 | REST API для записи | P2 | planned | L | POST/PUT/PATCH endpoints |
| IN-03 | API документация (OpenAPI/Swagger) | P1 | planned | M | Автогенерация из кода |
| IN-04 | Webhooks | P2 | planned | M | События: page.created, page.updated |
| IN-05 | Импорт из Markdown | P1 | planned | M | Загрузка .md файлов |
| IN-06 | Импорт из Confluence | P2 | planned | XL | API Confluence → AI Portal |
| IN-07 | Импорт из Notion | P2 | planned | XL | Notion API → AI Portal |
| IN-08 | Slack уведомления | P2 | planned | M | Уведомления об изменениях |
| IN-09 | GitHub синхронизация | P2 | planned | L | Sync с репозиторием |
| IN-10 | Embed widget | P3 | planned | L | Встраивание портала на внешний сайт |

---

## Модуль: UI/UX (Интерфейс)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| UX-01 | Главный layout (sidebar + content) | P0 | planned | M | |
| UX-02 | Навигация по дереву страниц | P0 | planned | M | Expandable/collapsible |
| UX-03 | Глобальный поиск (header) | P0 | planned | S | |
| UX-04 | AI prompt input (modal/inline) | P0 | planned | M | Интерфейс для промпта |
| UX-05 | Индикатор загрузки AI | P0 | planned | XS | Skeleton/loading state |
| UX-06 | Toast notifications | P1 | planned | S | Успех, ошибка, предупреждение |
| UX-07 | Breadcrumbs | P1 | planned | S | |
| UX-08 | Темная тема | P2 | planned | M | |
| UX-09 | Адаптивный дизайн (mobile/tablet) | P1 | planned | M | |
| UX-10 | Onboarding tour | P2 | planned | M | Интерактивный тур для новых пользователей |
| UX-11 | Keyboard shortcuts | P2 | planned | S | Ctrl+K поиск, Ctrl+S сохранение |
| UX-12 | Recently viewed pages | P2 | planned | S | Быстрый доступ |

---

## Модуль: Infrastructure (Инфраструктура)

| ID | Feature | Priority | Status | Estimate | Примечания |
|---|---|---|---|---|---|
| INF-01 | Docker + Docker Compose | P0 | planned | M | Один command для запуска |
| INF-02 | PostgreSQL настройка | P0 | planned | S | Migrations, seed data |
| INF-03 | Redis для кэширования | P1 | planned | S | |
| INF-04 | Nginx reverse proxy | P1 | planned | S | SSL termination |
| INF-05 | Health check endpoints | P1 | planned | XS | |
| INF-06 | Logging (structured logs) | P1 | planned | S | JSON logs, levels |
| INF-07 | Metrics (Prometheus) | P2 | planned | M | Метрики производительности |
| INF-08 | CI/CD pipeline | P1 | planned | M | GitHub Actions |
| INF-09 | E2E测试 (Playwright/Cypress) | P2 | planned | L | |
| INF-10 | Seed data для development | P1 | planned | S | Демо-данные |

---

## Summary по модулям

| Модуль | Total Features | Done | In Progress | Planned | Blocked | Deferred |
|---|---|---|---|---|---|---|
| Auth | 11 | 0 | 0 | 11 | 0 | 0 |
| Spaces | 9 | 0 | 0 | 9 | 0 | 0 |
| Pages | 16 | 0 | 0 | 16 | 0 | 0 |
| AI | 13 | 0 | 0 | 13 | 0 | 0 |
| Search | 10 | 0 | 0 | 10 | 0 | 0 |
| Permissions | 8 | 0 | 0 | 8 | 0 | 0 |
| Versions | 7 | 0 | 0 | 7 | 0 | 0 |
| Admin | 10 | 0 | 0 | 10 | 0 | 0 |
| Integrations | 10 | 0 | 0 | 10 | 0 | 0 |
| UI/UX | 12 | 0 | 0 | 12 | 0 | 0 |
| Infrastructure | 10 | 0 | 0 | 10 | 0 | 0 |
| **TOTAL** | **116** | **0** | **0** | **116** | **0** | **0** |

---

## Roadmap (предварительный)

### Sprint 1-2: Foundation (Must have — Auth + Spaces + Pages базовый)
- AUTH-01, AUTH-02, AUTH-04, AUTH-05, AUTH-06
- SP-01, SP-02, SP-04, SP-08
- PG-01, PG-02, PG-03, PG-04, PG-05, PG-06, PG-08
- UX-01, UX-02, UX-05
- INF-01, INF-02, INF-10

### Sprint 3-4: AI Core (Ключевое УТП)
- AI-01, AI-02, AI-03
- AD-01, AD-03
- UX-04, UX-06
- SP-06 (AI-генерация пространства)

### Sprint 5-6: Search + Permissions + Versions
- SR-01, SR-03, SR-04, SR-05
- PM-01, PM-02, PM-03, PM-05
- VS-01, VS-04
- PG-07, PG-09, PG-10

### Sprint 7-8: Polish + Admin + Integrations базовый
- AD-02, AD-04, AD-05, AD-06
- IN-01, IN-03, IN-05
- UX-03, UX-07, UX-09
- INF-03, INF-04, INF-06, INF-08

### Sprint 9+: Advanced features (Should/Could have)
- Оставшиеся features по всем модулям

---

## Примечания

- Все оценки предполагают команду 2-3 разработчика full-stack
- AI-модуль зависит от выбора LLM-провайдера и интеграции
- Search модуль может потребовать Elasticsearch для больших объёмов (>10k страниц)
- Integrations модуль имеет высокую вариативность — приоритизировать по запросам клиентов
