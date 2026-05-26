# Page-Gen Persistence + Delete + AI-Settings Modal — Design Spec

**Status:** Approved
**Date:** 2026-05-25
**Scope:** Frontend only (`frontend/src/pages/index.tsx`) + reuse of existing backend APIs. No backend changes.

## Problem

Three issues on the main workspace (`pages/index.tsx`):

1. **Generated pages don't persist.** `BuildPanel.handleBuild` calls `POST /api/ai/build` and renders the result as a local-state *preview* ("Предпросмотр — ещё не сохранено"). Persisting requires an explicit "Сохранить" click (`handleSave`), which posts to a **hardcoded `spaceId: 1`**. A user who generates and refreshes loses the page; even when saved, it lands in space 1 (often not where they are looking) → "сохранилось нигде".
2. **Delete is a stub.** The page-actions "Удалить" button runs `alert('Удаление — в разработке')`. Backend `DELETE /api/pages/:id` exists (gated by the `page.delete` capability).
3. **"Настройки AI" button is broken.** It sets `showSettings = true`, but the content component does `if (showSettings) return <div />; // Settings handled elsewhere` — nothing renders a settings UI, so clicking blanks the screen instead of opening settings.

## Approach (approved)

Auto-save generated pages immediately into the current space, wire up real delete, and render an AI-settings modal. Frontend-only; reuse existing `/api/pages` (create/delete) and `/api/settings/ai` (get/put) endpoints.

Rejected alternatives: keeping the preview gate but persisting a localStorage draft (hacky, loses on cache clear); a "draft" flag in the DB schema (no such field; over-engineered for the need).

## Design

### Part 1 — Save generated pages immediately
- In `BuildPanel.handleBuild`, after `POST /api/ai/build` returns the spec, immediately `POST /api/pages` with the generated `title` + `content`.
- Target space: `spaceId = selectedSpace ?? spaces[0]?.id` (from `useApp()`). Remove the hardcoded `spaceId: 1`.
- If there are **no spaces at all**: show toast «Сначала создайте пространство» and do not save (no generation persisted without a home).
- On success: `loadPages()`, open the new page via `selectPage`, toast «Страница создана». The preview→manual-save flow (`preview` state, "Сохранить"/"Отменить" buttons, `handleSave`) is removed.
- Permission: a role lacking `page.create` gets a backend **403** → surface a clear toast («Недостаточно прав для создания страниц»). The generated content is not silently dropped without explanation.

### Part 2 — Delete a page
- Replace the `alert('Удаление — в разработке')` handler on the "Удалить" button (page-actions sidebar, where `selectedPage` is in scope).
- Flow: `confirm('Удалить страницу «<title>»?')` → `DELETE /api/pages/:id` → on success clear selection (`selectPage(null)` / equivalent) + `loadPages()` + toast «Страница удалена».
- Permission: lacking `page.delete` → backend 403 → toast «Недостаточно прав для удаления».

### Part 3 — AI-settings modal
- Remove the dead `if (showSettings) return <div />` branch.
- Add a `SettingsModal` overlay component, rendered at the AppShell level when `showSettings === true`. Closing (✕ button or click on the overlay backdrop) calls `setShowSettings(false)`.
- Content: a compact per-user AI-settings form — **provider** (dropdown), **API key** (password input), **model** — loaded via `GET /api/settings/ai` and saved via `PUT /api/settings/ai` (the same endpoints the existing `/settings` page uses). Show a saved-confirmation; surface errors as toasts.
- Styling: reuse existing modal/overlay styles and design tokens already present in `pages/index.tsx`.

## Components / boundaries
- `BuildPanel` — owns generation + immediate persistence (Part 1).
- Page-actions sidebar button — owns delete (Part 2).
- `SettingsModal` — new, self-contained overlay; depends only on `showSettings`/`setShowSettings` from context and the `/api/settings/ai` endpoints (Part 3).

## Out of scope
- Backend changes (all required endpoints exist).
- "Копировать страницу" / "Экспорт в PDF" stubs (left as-is).
- Company-level AI config (`/admin/ai-config`) — the modal edits per-user settings only.
- Choosing a space before generation (decided: use current/first space).

## Testing
Playwright on dev :3009 (logged in as super_admin):
1. **Persistence:** generate a page → confirm it appears in the current space → reload the browser → page still present (not lost).
2. **Delete:** open a page → "Удалить" → confirm → page disappears from the list and DB.
3. **Settings modal:** click "Настройки AI" → modal opens with the AI-settings form → change a field, save → close → reopen shows persisted value.
4. **403 paths:** with a role lacking `page.create` / `page.delete`, confirm the explanatory toast (not a silent failure).
Confirm zero new console/React errors throughout.
