# Kanban Integration — Design Spec

**Date:** 2026-05-24
**Project:** ai-portal-final (branch `feat/ai-portal-redesign-and-fixes`)
**Status:** Approved (architecture A+C, all 5 phases)

## Problem

The portal ships a complete Kaiten-style kanban backend (boards, columns, swimlanes,
cards, labels, assignees, custom fields, archive/restore) and the home dashboard already
aggregates card data (`/api/home/my-cards`, `/activity`, `/calendar`). But the kanban is
**unreachable from the UI**: no navigation links to it, and the only board route is
misnamed (`pages/boards/[boardId]/page.tsx` → resolves to `/boards/<id>/page`, not
`/boards/<id>`). Cards and doc pages are not linked. The goal is to surface the kanban,
make it native to the design system, and integrate it deeply with spaces, pages, and the
home dashboard.

## Architecture (A + C)

**Model:** `Space` is a container for two first-class children: **Pages** (knowledge/docs)
and **Boards** (kanban/execution). This matches the existing schema — `boards.space_id`
(INTEGER) already references the space, exactly like pages.

- **Space-Hub (A):** the space detail view becomes a tabbed hub — **«Страницы» | «Доски»**.
- **Card ↔ Page link:** bidirectional via new nullable `cards.page_id`.
- **Home aggregation:** existing dashboard widgets become clickable into the owning card/board.
- **Global entry:** a «Доски» nav item in the main sidebar; a board-list page.
- **Macro embeds (C):** pages can embed a board or a card via the existing `MacroRenderer`
  macro system (read-only embeds), reusing the page editor's block/macro infrastructure.

### Key facts (grounding)
- `pages.id` is INTEGER (SERIAL); `cards.id` is UUID. So the link column is
  `cards.page_id INTEGER NULL REFERENCES pages(id) ON DELETE SET NULL`.
- Board page route bug: `pages/boards/[boardId]/page.tsx` must become
  `pages/boards/[boardId]/index.tsx` (Next.js pages router).
- `MacroRenderer` lives in `pages/index.tsx`; page block content is stored as JSON with
  `{ type: 'macro', macroName, macroProps }`.
- Backend board APIs: `backend/src/routes/boards.ts`. Home: `backend/src/routes/home.ts`
  (`my-cards` already returns `board_id`, `boardName`). Notifications table + `home/notifications` exist.
- Frontend kanban components (`frontend/src/components/kanban/*`) are already token-driven
  and de-purpled; they need polish + new feature surfaces, not a rewrite.
- Design system: tokens in `frontend/src/styles/design-system.css` + Tailwind config;
  primitives `MotionButton/Modal`; aesthetic governed by the `taste-skill`.
- Dev/verify workflow: host dev server on `:3009` (CORS origin added to `.env`), Playwright
  screenshot harness `/tmp/shot.mjs` (chromium-1217 explicit path); prod via
  `docker compose build frontend backend && up -d` on `:8080`.

## Out of scope
- Real-time/websocket board sync (cards refresh on action/poll, not live multi-user).
- Rebuilding drag-and-drop (preserve existing DnD in `KanbanBoard`).
- Re-architecting the dual page surfaces (`index.tsx` workspace vs `spaces/[id]` editor) —
  only add the Boards tab to the space view; no broader refactor.

---

## Phase 1 — Reachability + native design (foundation) ⭐ critical

**Deliverables**
- Rename `pages/boards/[boardId]/page.tsx` → `pages/boards/[boardId]/index.tsx`; verify
  `/boards/<id>` serves; update any internal references.
- New `pages/boards/index.tsx` — board list: `getBoards()`, optional `?spaceId` filter,
  "Новая доска" create flow, empty/loading/error states, taste-skill cards with Framer motion.
- Navigation: add «Доски» item to the main sidebar (`pages/index.tsx`); repoint existing
  «К доскам» links (they currently go to `/`) to `/boards`.
- Visual polish pass on `KanbanBoard`/`KanbanColumn`/`KanbanCard`/`ColumnHeader` (motion,
  diffusion shadows, spacing) — consistent with the rest of the redesign.

**Acceptance:** a logged-in user can reach `/boards`, open a board at `/boards/<id>`, and the
board renders natively (verified by Playwright screenshot, zero console errors).

## Phase 2 — Space-Hub + Boards↔Pages link ⭐ high

**Backend**
- Migration: add `cards.page_id INTEGER NULL REFERENCES pages(id) ON DELETE SET NULL` (idempotent in `db/init.ts`).
- `PATCH /api/cards/:id` accepts `page_id` (set/clear). `GET /api/cards/:id` returns linked page summary.
- `GET /api/pages/:id/cards` — cards linking to a page (id, title, board_id, column/status, priority).

**Frontend**
- Space detail (`spaces/[id].tsx`) gains a tab switcher **«Страницы» | «Доски»**; «Доски»
  lists the space's boards (reusing the board-list component) + create.
- `CardModal`: «Связанная страница» row — link/unlink (page picker), open page.
- Page right panel (`RightSidebar` in `index.tsx`): «Связанные задачи» list + «Создать задачу
  из страницы» (creates a card pre-linked to the page; prompts for board/column).

**Acceptance:** linking a card to a page is visible from both sides; creating a task from a
page produces a linked card.

## Phase 3 — Home integration + notifications ⭐ high

**Frontend**
- `home.tsx` «Мои задачи», Календарь chips, и Активность rows become clickable →
  navigate to `/boards/<board_id>?card=<card_id>`.
- Board page reads `?card=<id>` on load and opens `CardModal` focused on that card.

**Backend**
- Emit a notification (existing notifications table) on: card assignment to a user, and
  card due-soon (deadline within 24h) — surfaced via existing `home/notifications` +
  `NotificationsWidget`/`NotificationPanel`.

**Acceptance:** clicking a dashboard task opens its card; assigning a card notifies the assignee.

## Phase 4 — Macro embeds (C) ◆ medium

**Frontend**
- `MacroRenderer` (`index.tsx`): add `board` macro (compact read-only board — columns + card
  counts, links to full board) and `card` macro (card chip — title, status color, assignee).
  Resolve data client-side by id from `macroProps`.
- Page editor `AddBlockMenu`: add «Доска» / «Карточка» macro insertion (stores
  `{type:'macro', macroName:'board'|'card', macroProps:{id}}`).

**Acceptance:** a board/card embedded in a page renders live status; clicking opens the board/card.

## Phase 5 — User features ◆ medium/low (cut by taste)

- `CardModal` enrichment surfaces: checklists, comments, due date, labels, assignees
  (reuse existing label/assignee/custom-field APIs; add checklist + comment storage if absent).
- @mentions in card description/comments → notification to mentioned user.
- Board filters (assignee / priority / label) + inline quick-add card per column.
- «Моя работа» — a personal aggregated view of cards assigned to me across all boards,
  swimlaned by board (built on `/api/home/my-cards`).
- Visual WIP-limit enforcement per column (uses existing `wip_limit`).
- Surface card templates (wire the existing `TemplatesDialog`).

**Acceptance:** each feature has its own plan step with explicit acceptance; low-value items
may be dropped during planning.

---

## Cross-cutting

- **Design:** all new UI uses design-system tokens + `taste-skill` rules (single accent
  `#2563eb`, no purple, diffusion shadows, Framer Motion, Phosphor icons, Russian copy).
- **Verification:** every phase verified on the `:3009` dev server via Playwright screenshots
  (login + target page, zero console/HTTP errors), then a final `:8080` Docker rebuild.
- **Migrations:** additive and idempotent in `db/init.ts`; no destructive changes.
- **Sequencing:** phases are ordered by dependency (1 → 2 → 3 → 4 → 5) and shipped
  incrementally; each phase is independently mergeable.
