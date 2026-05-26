# Page-Gen Persistence + Delete + AI-Settings Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI-generated pages persist immediately into the current space, wire up real page deletion, and fix the broken "Настройки AI" button by rendering an AI-settings modal.

**Architecture:** Frontend-only changes in `frontend/src/pages/index.tsx` plus one new component `frontend/src/components/SettingsModal.tsx`. Reuse existing backend endpoints: `POST /api/pages`, `DELETE /api/pages/:id`, `GET`/`PUT /api/settings/ai`. No backend changes.

**Tech Stack:** Next.js (pages router), React, TypeScript, inline styles + CSS vars + Tailwind utility classes (the file already mixes these). Verification via Playwright against the dev server on `http://localhost:3009`.

**Spec:** `docs/superpowers/specs/2026-05-25-pagegen-persistence-and-settings-modal-design.md`

---

## Key facts (verified in code)

- `api(method, path, body?, token?)` helper and `getToken()` are defined at the top of `pages/index.tsx` (lines 31–47). `api` throws `Error` with the backend's `error` message on non-2xx.
- `useApp()` context (interface `AppContextValue`, lines 1249–1275) exposes: `spaces: Space[]`, `selectedSpace: number | null`, `selectPage(page: Page)`, `loadPages()`, `addToast(message, 'success'|'error'|'warning')`, `showSettings`, `setShowSettings`. It does **not** yet expose `setSelectedPage` (Task 2 adds it).
- `Space.id` is `number`; `Page` is `{ id: number; space_id?: number; title: string; content?: PageBlock[]; ... }`.
- `requirePermission` denials return `{ error: 'Forbidden: missing permission <cap>' }` → `api()` throws with that message (contains "Forbidden"/"permission").
- Per-user AI settings: `GET /api/settings/ai` → `{ provider, model, temperature, maxTokens, hasApiKey?, availableModels }`. `PUT /api/settings/ai` body `{ provider, apiKey?, model, temperature, maxTokens }`; `provider` enum is `openrouter|openai|anthropic|openclaw|local`.

## File Structure

- **Modify** `frontend/src/pages/index.tsx`:
  - `BuildPanel` (lines ~980–1062) — auto-save on generate (Task 1).
  - `AppContextValue` + `Home` context value (lines ~1249–1337) — expose `setSelectedPage` (Task 2).
  - `RightSidebar` (lines ~1104–1202) — wire delete button (Task 2).
  - `MainContent` (line 1089) — remove dead `if (showSettings) return <div />` (Task 3).
  - `Home` overlay block (lines ~1360–1375) — render `<SettingsModal/>` (Task 3).
- **Create** `frontend/src/components/SettingsModal.tsx` — self-contained AI-settings modal (Task 3).

---

## Task 1: Save generated pages immediately to the current space

**Files:**
- Modify: `frontend/src/pages/index.tsx` (replace the whole `BuildPanel` function, currently lines ~980–1062)

- [ ] **Step 1: Replace the `BuildPanel` function**

Find `function BuildPanel() {` (around line 980) and replace the entire function (from `function BuildPanel() {` through its closing `}` right before the `// ============ WELCOME ============` comment) with:

```tsx
function BuildPanel() {
  const { loadPages, addToast, selectPage, selectedSpace, spaces } = useApp();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBuild = async () => {
    const token = getToken();
    if (!token) { window.location.href = '/login'; return; }
    if (!prompt.trim()) return;
    const spaceId = selectedSpace ?? spaces[0]?.id;
    if (!spaceId) { addToast('Сначала создайте пространство', 'warning'); return; }
    setLoading(true);
    try {
      const spec = await api('POST', '/api/ai/build', { prompt }, token) as unknown as Page;
      const created = await api('POST', '/api/pages', {
        title: spec.title || 'Без названия',
        content: spec.content || [],
        spaceId,
        acl: { readers: ['all'] },
      }, token) as unknown as Page;
      addToast('Страница создана', 'success');
      setPrompt('');
      await loadPages();
      selectPage(created);
    } catch (e) {
      const msg = (e as Error).message || '';
      const denied = msg.includes('Forbidden') || msg.includes('permission');
      addToast(denied ? 'Недостаточно прав для создания страниц' : 'Ошибка: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={R.centered}>
      <div className="w-full max-w-[560px] rounded-3xl border border-line bg-surface p-8 shadow-diffusion">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
            <MagicWand size={22} weight="duotone" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-fg">Генерация страницы</h2>
            <p className="text-sm text-fg-muted">Опишите, какую страницу создать на естественном языке</p>
          </div>
        </div>
        <textarea
          className="mt-5 min-h-[140px] w-full resize-y rounded-2xl border border-line bg-bg-alt p-3.5 text-[0.95rem] text-fg outline-none transition placeholder:text-fg-muted focus:border-accent focus:ring-4 focus:ring-accent/15"
          placeholder="Например: создайте страницу команды с разделами — цели, участники, KPI"
          value={prompt} onChange={e => setPrompt(e.target.value)} rows={5}
        />
        <button
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold tracking-tight text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleBuild} disabled={!prompt.trim() || loading}>
          {loading ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : <MagicWand size={16} weight="fill" />}
          {loading ? 'Генерация…' : 'Сгенерировать'}
        </button>
      </div>
    </div>
  );
}
```

This removes the `preview`/`saved` state, `handleSave`, `setPreviewPage`, and the `if (preview) { ... }` preview-gate JSX. Generation now persists immediately to `selectedSpace ?? spaces[0]?.id` and opens the saved page.

- [ ] **Step 2: Type-check**

Run: `cd /home/nikita/ai-portal-final/frontend && npx tsc --noEmit`
Expected: clean (no new errors). If `setPreviewPage` is now reported unused elsewhere, leave it — it is still used by other components/context; only `BuildPanel` stopped using it.

- [ ] **Step 3: Verify persistence with Playwright**

Create `/tmp/verify-save.mjs`:

```js
import pkg from '/home/nikita/ai-portal-final/frontend/node_modules/playwright-core/index.js';
const { chromium } = pkg;
const BASE = 'http://localhost:3009';
const browser = await chromium.launch({ headless: true, executablePath: '/home/nikita/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#email', 'admin@portal.com'); await page.fill('#password', 'admin123');
await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{}), page.click('button[type=submit]').catch(()=>{})]);
await page.waitForTimeout(1500);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
// select first space if a list is shown
await page.getByPlaceholder(/создайте страницу команды/i).fill('Тестовая страница для проверки сохранения').catch(()=>{});
await page.getByRole('button', { name: /Сгенерировать/ }).click().catch(()=>{});
await page.waitForTimeout(20000); // wait for kimi generation + save
const title = 'Тестовая страница';
const beforeReload = await page.getByText(new RegExp(title)).count();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const afterReload = await page.getByText(new RegExp(title)).count();
console.log(JSON.stringify({ beforeReload, afterReload, errors }, null, 2));
await page.screenshot({ path: '/tmp/verify-save.png', fullPage: true });
await browser.close();
```

Run: `cd /home/nikita/ai-portal-final/frontend && node /tmp/verify-save.mjs`
Expected: `afterReload >= 1` (the generated page survives reload — it is listed in the sidebar/space), `errors: []`. Read `/tmp/verify-save.png` to confirm the page rendered in the current space.

- [ ] **Step 4: Commit**

```bash
cd /home/nikita/ai-portal-final
git add frontend/src/pages/index.tsx
git commit -m "feat(pages): auto-save AI-generated pages into the current space"
```

---

## Task 2: Wire up page deletion

**Files:**
- Modify: `frontend/src/pages/index.tsx` (expose `setSelectedPage` in context; add delete handler in `RightSidebar`)

- [ ] **Step 1: Expose `setSelectedPage` in the context interface**

In `interface AppContextValue` (around line 1255, right after the `selectedPage: Page | null;` line), add:

```tsx
  setSelectedPage: React.Dispatch<React.SetStateAction<Page | null>>;
```

- [ ] **Step 2: Add `setSelectedPage` to the provided context value**

In `Home`, find the `const contextValue: AppContextValue = { ... }` object (around line 1331). Add `setSelectedPage` to it. Change:

```tsx
    spaces, setSpaces, pages, setPages, selectedSpace, selectedPage, sidebarSearch, setSidebarSearch,
```
to:
```tsx
    spaces, setSpaces, pages, setPages, selectedSpace, selectedPage, setSelectedPage, sidebarSearch, setSidebarSearch,
```
(`setSelectedPage` already exists as a `useState` setter in `Home` at line 1283.)

- [ ] **Step 3: Add a delete handler in `RightSidebar` and wire the button**

In `function RightSidebar(...)` (line 1104), after the existing `const [showSidebar, setShowSidebar] = useState(true);` line (1108), add:

```tsx
  const { loadPages, addToast, setSelectedPage } = useApp();

  const handleDelete = async () => {
    if (!page) return; // only real (saved) pages, never a preview
    if (!confirm(`Удалить страницу «${page.title}»?`)) return;
    const token = getToken();
    if (!token) return;
    try {
      await api('DELETE', `/api/pages/${page.id}`, null, token);
      addToast('Страница удалена', 'success');
      setSelectedPage(null);
      await loadPages();
    } catch (e) {
      const msg = (e as Error).message || '';
      const denied = msg.includes('Forbidden') || msg.includes('permission');
      addToast(denied ? 'Недостаточно прав для удаления' : 'Ошибка: ' + msg, 'error');
    }
  };
```

Then replace the "Удалить" button (line ~1195):

```tsx
              <button style={{ ...sidebarBtnStyle, color: '#ef4444', borderColor: '#fecaca', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => alert('Удаление — в разработке')}><Trash size={16} weight="duotone" />Удалить</button>
```
with:
```tsx
              <button style={{ ...sidebarBtnStyle, color: '#ef4444', borderColor: '#fecaca', display: 'flex', alignItems: 'center', gap: 8 }} onClick={handleDelete}><Trash size={16} weight="duotone" />Удалить</button>
```

- [ ] **Step 4: Type-check**

Run: `cd /home/nikita/ai-portal-final/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Verify deletion with Playwright**

Create `/tmp/verify-delete.mjs`:

```js
import pkg from '/home/nikita/ai-portal-final/frontend/node_modules/playwright-core/index.js';
const { chromium } = pkg;
const BASE = 'http://localhost:3009';
const browser = await chromium.launch({ headless: true, executablePath: '/home/nikita/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept()); // auto-confirm the delete confirm()
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#email', 'admin@portal.com'); await page.fill('#password', 'admin123');
await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{}), page.click('button[type=submit]').catch(()=>{})]);
await page.waitForTimeout(1500);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// open the first page in the sidebar (a FileText link/button)
const firstPage = page.locator('text=/.*/').first();
// Click a page entry — adjust selector to the sidebar page item
await page.locator('aside a, aside button').filter({ hasText: /.+/ }).first().click().catch(()=>{});
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /Удалить/ }).click().catch(()=>{});
await page.waitForTimeout(2000);
const toast = await page.getByText('Страница удалена').count();
console.log(JSON.stringify({ deletedToast: toast, errors }, null, 2));
await page.screenshot({ path: '/tmp/verify-delete.png', fullPage: true });
await browser.close();
```

Run: `cd /home/nikita/ai-portal-final/frontend && node /tmp/verify-delete.mjs`
Expected: `deletedToast >= 1` (the "Страница удалена" toast appeared) and `errors: []`. (The exact sidebar selectors may need a small tweak when running — confirm via the screenshot that a page was opened then removed.)

- [ ] **Step 6: Commit**

```bash
cd /home/nikita/ai-portal-final
git add frontend/src/pages/index.tsx
git commit -m "feat(pages): wire up page deletion with confirm + permission-aware toast"
```

---

## Task 3: AI-settings modal (fix broken "Настройки AI" button)

**Files:**
- Create: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/src/pages/index.tsx` (remove dead `showSettings` branch; render the modal)

- [ ] **Step 1: Create `frontend/src/components/SettingsModal.tsx`**

```tsx
'use client';
import React, { useState, useEffect } from 'react';

const API = typeof window !== 'undefined' ? 'http://' + window.location.hostname + ':8081' : '';
const PROVIDERS = ['openrouter', 'openai', 'anthropic', 'openclaw', 'local'];

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

interface AiSettings {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  hasApiKey?: boolean;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(API + '/api/settings/ai', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then((d: AiSettings) => {
        setProvider(d.provider || 'openrouter');
        setModel(d.model || '');
        setTemperature(d.temperature ?? 0.7);
        setMaxTokens(d.maxTokens ?? 4000);
        setHasApiKey(!!d.hasApiKey);
      })
      .catch(() => setStatus('Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const token = getToken();
    if (!token) return;
    setSaving(true); setStatus('');
    try {
      const res = await fetch(API + '/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ provider, apiKey: apiKey || undefined, model, temperature, maxTokens }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Ошибка сохранения');
      setApiKey('');
      setHasApiKey(!!(data as AiSettings).hasApiKey || hasApiKey);
      setStatus('Сохранено');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(92vw, 460px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>Настройки AI</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--color-text-muted)' }}>Загрузка…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Провайдер
              <select value={provider} onChange={e => setProvider(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)' }}>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Модель
              <input value={model} onChange={e => setModel(e.target.value)} placeholder="например, gpt-4o"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              API ключ {hasApiKey && <span style={{ color: 'var(--color-text-muted)' }}>(сохранён ранее — оставьте пустым, чтобы не менять)</span>}
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..."
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)' }} />
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
              <button onClick={handleSave} disabled={saving || !model.trim()}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button onClick={onClose}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Закрыть
              </button>
              {status && <span style={{ fontSize: '0.85rem', color: status === 'Сохранено' ? '#22c55e' : '#ef4444' }}>{status}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Import the modal and remove the dead branch in `pages/index.tsx`**

At the top of `pages/index.tsx`, after the existing component imports (e.g. after the `import NotificationPanel from '../components/NotificationPanel';` line, ~line 7), add:

```tsx
import SettingsModal from '../components/SettingsModal';
```

Then in `MainContent` (line 1088–1089), remove the dead settings branch. Change:

```tsx
  const { selectedPage, editMode, directEditMode, showSettings } = useApp();
  if (showSettings) return <div />; // Settings handled elsewhere
```
to:
```tsx
  const { selectedPage, editMode, directEditMode } = useApp();
```

- [ ] **Step 3: Render the modal in `Home`**

In `Home`, find the `{showNotificationPanel && ( ... )}` block (~line 1373). Immediately after the `showAIAssistant` block and before/after the `showNotificationPanel` block, add:

```tsx
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
```

(`showSettings` and `setShowSettings` are already destructured/available in `Home` via the `contextValue` locals.)

- [ ] **Step 4: Type-check**

Run: `cd /home/nikita/ai-portal-final/frontend && npx tsc --noEmit`
Expected: clean. (If `showSettings` is reported unused in `MainContent`, that is expected — it was removed there; it is still used in `Home`.)

- [ ] **Step 5: Verify the modal with Playwright**

Create `/tmp/verify-settings.mjs`:

```js
import pkg from '/home/nikita/ai-portal-final/frontend/node_modules/playwright-core/index.js';
const { chromium } = pkg;
const BASE = 'http://localhost:3009';
const browser = await chromium.launch({ headless: true, executablePath: '/home/nikita/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#email', 'admin@portal.com'); await page.fill('#password', 'admin123');
await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{}), page.click('button[type=submit]').catch(()=>{})]);
await page.waitForTimeout(1500);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /Настройки AI/ }).click();
await page.waitForTimeout(1000);
const modalOpen = await page.getByRole('heading', { name: 'Настройки AI' }).count();
await page.screenshot({ path: '/tmp/verify-settings.png', fullPage: true });
console.log(JSON.stringify({ modalOpen, errors }, null, 2));
await browser.close();
```

Run: `cd /home/nikita/ai-portal-final/frontend && node /tmp/verify-settings.mjs`
Expected: `modalOpen >= 1` (the modal heading "Настройки AI" is visible) and `errors: []`. Read `/tmp/verify-settings.png` to confirm the form renders.

- [ ] **Step 6: Commit**

```bash
cd /home/nikita/ai-portal-final
git add frontend/src/components/SettingsModal.tsx frontend/src/pages/index.tsx
git commit -m "feat(settings): render AI-settings modal from the Настройки AI button"
```

---

## Final: build + (optional) deploy

- [ ] Rebuild the local prod frontend so :8080 reflects the changes: `cd /home/nikita/ai-portal-final && docker compose build frontend && docker compose up -d frontend`, then re-run the three verify scripts against `http://localhost:8080` (change `BASE`) to confirm in prod.
- [ ] Push the branch and open/merge a PR, and deploy to the VPS — only when the user asks (outward-facing).

## Self-Review

- **Spec coverage:** Part 1 save-immediately → Task 1 ✓ (uses `selectedSpace ?? spaces[0]?.id`, no-space toast, 403 toast). Part 2 delete → Task 2 ✓ (confirm + `DELETE /api/pages/:id` + clear selection + reload + 403 toast). Part 3 settings modal → Task 3 ✓ (new `SettingsModal`, dead branch removed, rendered in `Home`, `GET/PUT /api/settings/ai`). No gaps.
- **Placeholders:** none — full code given for every changed region; verify scripts are complete.
- **Type consistency:** `setSelectedPage: React.Dispatch<React.SetStateAction<Page | null>>` matches the `useState<Page | null>` setter in `Home`; `selectPage(page: Page)`, `addToast(msg, type)`, `api(method, path, body, token)`, `Space.id: number`, `Page.id: number` used consistently. The settings modal's `provider` values match the backend enum (`openrouter|openai|anthropic|openclaw|local`).
- **Note:** the modal edits per-user AI settings; the page generator uses the company-level config (Kimi) unless a per-user override is saved — this matches the existing `/settings` page behavior and the approved spec (company config out of scope).
