# Permission Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a granular, DB-editable role×capability permission matrix with `requirePermission` enforcement and an admin matrix UI, on top of the existing 4-role model.

**Architecture:** A code-defined capability catalog (`resource.action`) is the source of truth. A `role_permissions` table stores which company role has which capability, seeded with defaults and editable via the admin UI. `permissionService` caches the matrix in memory and answers `can(role, capability)`; `requirePermission(cap)` middleware enforces it (super_admin always allowed). The `/admin/roles` page renders an editable matrix grid.

**Tech Stack:** TypeScript, Express, node-postgres (`pg` Pool), Jest + ts-jest (backend); Next.js (pages router), Tailwind tokens + Framer Motion (frontend).

**Spec:** `docs/superpowers/specs/2026-05-25-permission-matrix-design.md`

> **PROGRESS (2026-05-25):** R1 backend infrastructure (Tasks 1–5) is DONE, committed
> (`5364fcf`, `36b6c58`, `fb9d509`, `3946b18`, `e35dec1`), unit-tested, and runtime-verified
> (backend rebuilt boots healthy; seed counts super_admin 22 / admin 21 / employee 13 / guest 3;
> `GET /api/admin/permissions` returns the matrix). **RESUME AT Task 6** (enforcement on
> spaces/pages/boards/cards mutations) → Task 7–8 (matrix UI) → Task 9 (optional). Note for
> Task 6: PATCH `/cards/:id` should use `requirePermission('card.update')` (move goes through the
> same endpoint; `card.move` stays catalog-only for now). After Task 6, rebuild backend + verify
> 403 for under-privileged roles before moving on. Backend tests run on host: `cd backend && npx jest`.

> **PROGRESS (2026-05-25, cont.):** R1 enforcement (Task 6, commit `063a246`) + R2 matrix UI
> (Task 7 `55252aa`, Task 8 `c260c4e`) are DONE and runtime-verified. Task 6 gates exactly 18
> mutation routes (spaces/pages/boards/cards/columns create-update-delete); `cards.ts` gained the
> missing `authMiddleware`; `card.move` left catalog-only as noted. Enforcement verified on the
> rebuilt backend: guest→403 board.create, employee→403 board.delete, super_admin bypass, and a
> matrix PATCH toggle is reflected on the next request (cache reload). Task 8 was implemented as
> TWO TABS on `/admin/roles` ("Пользователи" = existing user-role UI, preserved; "Матрица прав" =
> new editable grid) — the plan's "replace page body" was overridden because the page already had
> working functionality. UI verified on dev :3009 AND rebuilt prod :8080 (renders, toggle persists
> across reload, no React errors). **Task 9 (R3) intentionally SKIPPED:** `requireDepartmentRole`/
> `requireObjectRole` are used by no route (the fields would be inert), and `UsersRepository.
> getFullProfile()` already loads dept/object roles — revisit only when a route needs that gating.

---

## File Structure

**Backend (create):**
- `backend/src/rbac/capabilities.ts` — capability catalog + default matrix (source of truth)
- `backend/src/services/permissionService.ts` — load/cache/`can`/`reload`
- `backend/src/services/__tests__/permissionService.test.ts` — unit tests for `can` logic
- `backend/src/middleware/__tests__/requirePermission.test.ts` — middleware unit tests

**Backend (modify):**
- `backend/src/db/init.ts` — add `role_permissions` table + idempotent seed
- `backend/src/middleware/rbac.ts` — add `requirePermission(cap)`
- `backend/src/middleware/index.ts` — export `requirePermission`
- `backend/src/routes/admin.ts` — `GET`/`PATCH /api/admin/permissions`
- `backend/src/routes/{spaces,pages,boards,cards}.ts` — apply `requirePermission` to mutations

**Frontend (modify):**
- `frontend/src/pages/admin/roles/index.tsx` — permission matrix UI
- `frontend/src/lib/admin-api.ts` — `getPermissions()` / `updatePermission()`

---

## Phase R1 — Backend foundation

### Task 1: Capability catalog

**Files:**
- Create: `backend/src/rbac/capabilities.ts`

- [ ] **Step 1: Create the catalog module**

```typescript
import type { CompanyRole } from '../types';

export interface Capability {
  key: string;        // e.g. "board.create"
  resource: string;   // e.g. "board"
  action: string;     // e.g. "create"
  label: string;      // RU label for UI
}

export const CAPABILITIES: Capability[] = [
  { key: 'space.create', resource: 'space', action: 'create', label: 'Создавать пространства' },
  { key: 'space.read',   resource: 'space', action: 'read',   label: 'Просматривать пространства' },
  { key: 'space.update', resource: 'space', action: 'update', label: 'Изменять пространства' },
  { key: 'space.delete', resource: 'space', action: 'delete', label: 'Удалять пространства' },
  { key: 'page.create',  resource: 'page',  action: 'create', label: 'Создавать страницы' },
  { key: 'page.read',    resource: 'page',  action: 'read',   label: 'Просматривать страницы' },
  { key: 'page.update',  resource: 'page',  action: 'update', label: 'Изменять страницы' },
  { key: 'page.delete',  resource: 'page',  action: 'delete', label: 'Удалять страницы' },
  { key: 'board.create', resource: 'board', action: 'create', label: 'Создавать доски' },
  { key: 'board.read',   resource: 'board', action: 'read',   label: 'Просматривать доски' },
  { key: 'board.update', resource: 'board', action: 'update', label: 'Изменять доски' },
  { key: 'board.delete', resource: 'board', action: 'delete', label: 'Удалять доски' },
  { key: 'card.create',  resource: 'card',  action: 'create', label: 'Создавать карточки' },
  { key: 'card.update',  resource: 'card',  action: 'update', label: 'Изменять карточки' },
  { key: 'card.delete',  resource: 'card',  action: 'delete', label: 'Удалять карточки' },
  { key: 'card.move',    resource: 'card',  action: 'move',   label: 'Перемещать карточки' },
  { key: 'column.manage',resource: 'column',action: 'manage', label: 'Управлять колонками' },
  { key: 'user.manage',       resource: 'admin', action: 'user.manage',       label: 'Управлять пользователями' },
  { key: 'department.manage', resource: 'admin', action: 'department.manage', label: 'Управлять отделами' },
  { key: 'role.manage',       resource: 'admin', action: 'role.manage',       label: 'Управлять правами (этой матрицей)' },
  { key: 'aiconfig.manage',   resource: 'admin', action: 'aiconfig.manage',   label: 'Настраивать ИИ' },
  { key: 'brand.manage',      resource: 'admin', action: 'brand.manage',      label: 'Настраивать брендинг' },
];

export const CAPABILITY_KEYS = new Set(CAPABILITIES.map(c => c.key));

// Default allowed capability keys per role (super_admin implicitly = all).
export const DEFAULT_MATRIX: Record<Exclude<CompanyRole, 'super_admin'>, string[]> = {
  admin: CAPABILITIES.filter(c => c.key !== 'role.manage').map(c => c.key),
  employee: [
    'space.read', 'space.create', 'space.update',
    'page.read', 'page.create', 'page.update',
    'board.read', 'board.create', 'board.update',
    'card.create', 'card.update', 'card.move', 'column.manage',
  ],
  guest: ['space.read', 'page.read', 'board.read'],
};

export const ALL_ROLES: CompanyRole[] = ['super_admin', 'admin', 'employee', 'guest'];
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/rbac/capabilities.ts
git commit -m "feat(rbac): capability catalog + default matrix"
```

### Task 2: `role_permissions` table + seed

**Files:**
- Modify: `backend/src/db/init.ts`

- [ ] **Step 1: Add table + idempotent seed**

Locate the schema-creation block in `init.ts` (near the other `CREATE TABLE IF NOT EXISTS` statements, e.g. after `company_roles`). Add:

```typescript
await client.query(`
  CREATE TABLE IF NOT EXISTS role_permissions (
    role company_role_level NOT NULL,
    capability VARCHAR(64) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (role, capability)
  );
`);
```

After the schema block (in the same init flow that seeds the super_admin), seed defaults idempotently:

```typescript
import { CAPABILITIES, DEFAULT_MATRIX } from '../rbac/capabilities';
// ...
for (const cap of CAPABILITIES) {
  // super_admin: always allowed
  await client.query(
    `INSERT INTO role_permissions (role, capability, allowed) VALUES ('super_admin', $1, TRUE)
     ON CONFLICT (role, capability) DO NOTHING`, [cap.key]);
  for (const role of ['admin', 'employee', 'guest'] as const) {
    const allowed = DEFAULT_MATRIX[role].includes(cap.key);
    await client.query(
      `INSERT INTO role_permissions (role, capability, allowed) VALUES ($1, $2, $3)
       ON CONFLICT (role, capability) DO NOTHING`, [role, cap.key, allowed]);
  }
}
```

`ON CONFLICT DO NOTHING` makes it safe on every boot and auto-seeds newly added capabilities without overwriting admin edits.

- [ ] **Step 2: Restart backend, verify table seeded**

Run: `docker compose restart backend && sleep 4 && docker exec ai-portal-final-postgres-1 psql -U portal -d portal -tAc "SELECT role, count(*) FILTER (WHERE allowed) FROM role_permissions GROUP BY role ORDER BY role"`
Expected: 4 rows; super_admin count = total capabilities; guest = 3.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/init.ts
git commit -m "feat(rbac): role_permissions table + idempotent default seed"
```

### Task 3: permissionService (pure `can` logic, TDD)

**Files:**
- Create: `backend/src/services/permissionService.ts`
- Test: `backend/src/services/__tests__/permissionService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { PermissionService } from '../permissionService';

describe('PermissionService.can', () => {
  const svc = new PermissionService();
  // inject an in-memory matrix instead of loading from DB
  svc.setMatrixForTest({
    admin: new Set(['board.create']),
    employee: new Set(['board.read']),
    guest: new Set(['board.read']),
  });

  it('super_admin can do anything (bypass)', () => {
    expect(svc.can('super_admin', 'board.delete')).toBe(true);
  });
  it('admin can do granted capability', () => {
    expect(svc.can('admin', 'board.create')).toBe(true);
  });
  it('employee denied capability not granted', () => {
    expect(svc.can('employee', 'board.create')).toBe(false);
  });
  it('guest can read', () => {
    expect(svc.can('guest', 'board.read')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest permissionService -c jest.config.js`
Expected: FAIL — cannot find module `../permissionService`.

- [ ] **Step 3: Implement permissionService**

```typescript
import { pool } from '../config';
import type { CompanyRole } from '../types';

type Matrix = Partial<Record<CompanyRole, Set<string>>>;

export class PermissionService {
  private matrix: Matrix = {};

  async load(): Promise<void> {
    const { rows } = await pool.query<{ role: CompanyRole; capability: string; allowed: boolean }>(
      'SELECT role, capability, allowed FROM role_permissions'
    );
    const m: Matrix = {};
    for (const r of rows) {
      if (!m[r.role]) m[r.role] = new Set();
      if (r.allowed) m[r.role]!.add(r.capability);
    }
    this.matrix = m;
  }

  async reload(): Promise<void> { await this.load(); }

  setMatrixForTest(m: Record<string, Set<string>>): void { this.matrix = m as Matrix; }

  can(role: CompanyRole, capability: string): boolean {
    if (role === 'super_admin') return true;
    return this.matrix[role]?.has(capability) ?? false;
  }

  async setAllowed(role: CompanyRole, capability: string, allowed: boolean): Promise<void> {
    if (role === 'super_admin') return; // immutable
    await pool.query(
      `INSERT INTO role_permissions (role, capability, allowed) VALUES ($1,$2,$3)
       ON CONFLICT (role, capability) DO UPDATE SET allowed = EXCLUDED.allowed`,
      [role, capability, allowed]
    );
    await this.reload();
  }
}

export const permissionService = new PermissionService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest permissionService -c jest.config.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Load matrix at startup**

In `backend/src/index.ts`, after DB init / before `app.listen`, add:

```typescript
import { permissionService } from './services/permissionService';
await permissionService.load();
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/permissionService.ts backend/src/services/__tests__/permissionService.test.ts backend/src/index.ts
git commit -m "feat(rbac): permissionService with cached can() + tests"
```

### Task 4: `requirePermission` middleware (TDD)

**Files:**
- Modify: `backend/src/middleware/rbac.ts`, `backend/src/middleware/index.ts`
- Test: `backend/src/middleware/__tests__/requirePermission.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { requirePermission } from '../rbac';
import { permissionService } from '../../services/permissionService';

function mockRes() {
  const res: any = { statusCode: 0, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

describe('requirePermission', () => {
  beforeAll(() => {
    permissionService.setMatrixForTest({ employee: new Set(['board.read']) } as any);
  });
  it('401 when unauthenticated', () => {
    const res = mockRes(); let nexted = false;
    requirePermission('board.read')({} as any, res, () => { nexted = true; });
    expect(res.statusCode).toBe(401); expect(nexted).toBe(false);
  });
  it('allows when role has capability', () => {
    const res = mockRes(); let nexted = false;
    const req: any = { user: { id: 'u', companyId: 'c', companyRole: 'employee' } };
    requirePermission('board.read')(req, res, () => { nexted = true; });
    expect(nexted).toBe(true);
  });
  it('403 when role lacks capability', () => {
    const res = mockRes(); let nexted = false;
    const req: any = { user: { id: 'u', companyId: 'c', companyRole: 'employee' } };
    requirePermission('board.delete')(req, res, () => { nexted = true; });
    expect(res.statusCode).toBe(403); expect(nexted).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest requirePermission -c jest.config.js`
Expected: FAIL — `requirePermission` is not exported.

- [ ] **Step 3: Implement middleware**

Add to `backend/src/middleware/rbac.ts` (imports `permissionService` and `auditService` already present):

```typescript
import { permissionService } from '../services/permissionService';

/**
 * requirePermission(capability) — checks the user's company role against the
 * editable permission matrix. super_admin always passes.
 */
export function requirePermission(capability: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!permissionService.can(req.user.companyRole, capability)) {
      auditService.logPermissionDenied(
        req.user.companyId, req.user.id, `requirePermission(${capability})`, 'capability', capability
      );
      res.status(403).json({ error: `Forbidden: missing permission ${capability}` });
      return;
    }
    next();
  };
}
```

Export it from `backend/src/middleware/index.ts` (add `requirePermission` to the existing rbac re-export list).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest requirePermission -c jest.config.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/rbac.ts backend/src/middleware/index.ts backend/src/middleware/__tests__/requirePermission.test.ts
git commit -m "feat(rbac): requirePermission middleware + tests"
```

### Task 5: Permissions API (GET/PATCH)

**Files:**
- Modify: `backend/src/routes/admin.ts`

- [ ] **Step 1: Add GET (admin+) and PATCH (role.manage) handlers**

```typescript
import { CAPABILITIES, CAPABILITY_KEYS, ALL_ROLES } from '../rbac/capabilities';
import { permissionService } from '../services/permissionService';
import { requireAdmin, requirePermission } from '../middleware';
import { pool } from '../config';

// GET /api/admin/permissions — admin+ may view the matrix
router.get('/permissions', authMiddleware, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query('SELECT role, capability, allowed FROM role_permissions');
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const role of ALL_ROLES) matrix[role] = {};
  for (const r of rows as { role: string; capability: string; allowed: boolean }[]) {
    if (matrix[r.role]) matrix[r.role][r.capability] = r.allowed;
  }
  // super_admin always all-true (defensive, in case of drift)
  for (const c of CAPABILITIES) matrix['super_admin'][c.key] = true;
  res.json({ capabilities: CAPABILITIES, roles: ALL_ROLES, matrix });
});

// PATCH /api/admin/permissions — only role.manage (super_admin by default) may edit
router.patch('/permissions', authMiddleware, requirePermission('role.manage'), async (req, res) => {
  const { role, capability, allowed } = req.body as { role?: string; capability?: string; allowed?: boolean };
  if (!role || role === 'super_admin' || !ALL_ROLES.includes(role as any)) {
    return res.status(400).json({ error: 'invalid or immutable role' });
  }
  if (!capability || !CAPABILITY_KEYS.has(capability)) {
    return res.status(400).json({ error: 'unknown capability' });
  }
  await permissionService.setAllowed(role as any, capability, Boolean(allowed));
  res.json({ ok: true, role, capability, allowed: Boolean(allowed) });
});
```

(Place these in `admin.ts` near the other admin routes; reuse the file's existing `router`/`authMiddleware` imports.)

- [ ] **Step 2: Verify via curl (super_admin token)**

Run (dev :3009 backend at :8081):
```bash
TOK=$(curl -s -X POST http://localhost:8081/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@portal.com","password":"admin123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
curl -s -H "Authorization: Bearer $TOK" http://localhost:8081/api/admin/permissions | head -c 200
curl -s -X PATCH -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"role":"guest","capability":"board.read","allowed":false}' http://localhost:8081/api/admin/permissions
```
Expected: GET returns `{capabilities,roles,matrix}`; PATCH returns `{ok:true,...}`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin.ts
git commit -m "feat(rbac): GET/PATCH /api/admin/permissions"
```

### Task 6: Enforce on mutation routes

**Files:**
- Modify: `backend/src/routes/spaces.ts`, `pages.ts`, `boards.ts`, `cards.ts`

- [ ] **Step 1: Add `requirePermission` to each mutation route**

For each route handler, insert the matching middleware after `authMiddleware`. Examples (apply the analogous capability to each verb):

```typescript
// spaces.ts
router.post('/', authMiddleware, requirePermission('space.create'), /* existing handler */);
router.patch('/:id', authMiddleware, requirePermission('space.update'), /* ... */);
router.delete('/:id', authMiddleware, requirePermission('space.delete'), /* ... */);
// pages.ts → page.create/update/delete ; reads stay open or page.read
// boards.ts → board.create/update/delete ; columns → column.manage
// cards.ts → card.create/update/delete ; column move (PATCH column_id) → card.move
```

Import `requirePermission` from `../middleware` in each file. Leave GET/read routes ungated (or add `*.read` only if guests must be blocked).

- [ ] **Step 2: Verify enforcement with role tokens**

Run (using the guest-denied `board.read` toggle from Task 5, then a fresh employee/guest user if available, or temporarily set a capability off and confirm 403):
```bash
# with a non-super_admin token lacking board.delete -> expect 403
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE -H "Authorization: Bearer $EMP_TOK" http://localhost:8081/api/boards/<id>
```
Expected: 403 for roles lacking the capability; 200/expected for those with it.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/spaces.ts backend/src/routes/pages.ts backend/src/routes/boards.ts backend/src/routes/cards.ts
git commit -m "feat(rbac): enforce requirePermission on space/page/board/card mutations"
```

---

## Phase R2 — Admin matrix UI

### Task 7: admin-api permission functions

**Files:**
- Modify: `frontend/src/lib/admin-api.ts`

- [ ] **Step 1: Add typed API helpers**

```typescript
export interface Capability { key: string; resource: string; action: string; label: string; }
export interface PermissionMatrix {
  capabilities: Capability[];
  roles: string[];
  matrix: Record<string, Record<string, boolean>>;
}
export async function getPermissions(): Promise<PermissionMatrix> {
  return apiGet<PermissionMatrix>('/api/admin/permissions');   // reuse existing fetch helper in this file
}
export async function updatePermission(role: string, capability: string, allowed: boolean): Promise<void> {
  await apiPatch('/api/admin/permissions', { role, capability, allowed }); // reuse existing helper
}
```

(Match the file's existing fetch-helper names; if it uses a single `api(method, path, body)` helper, call that instead.)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/admin-api.ts
git commit -m "feat(rbac): admin-api getPermissions/updatePermission"
```

### Task 8: Permission matrix grid UI

**Files:**
- Modify: `frontend/src/pages/admin/roles/index.tsx`

- [ ] **Step 1: Replace page body with the matrix grid**

Render inside `AdminLayout`. Group `capabilities` by `resource`; columns = `roles`; each cell a checkbox. `super_admin` column always checked + disabled. Other cells: checked from `matrix[role][cap.key]`; `onChange` calls `updatePermission` optimistically and reverts on error. Include loading skeleton, error alert, and a saved-toast. Use design-system tokens (`bg-surface/border-line/text-fg/accent`), `font-mono` for role headers, and the `admin.module.css` table styles already present.

```tsx
const [data, setData] = useState<PermissionMatrix | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
useEffect(() => { getPermissions().then(d => { setData(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); }); }, []);
async function toggle(role: string, key: string, next: boolean) {
  setData(d => d && ({ ...d, matrix: { ...d.matrix, [role]: { ...d.matrix[role], [key]: next } } }));
  try { await updatePermission(role, key, next); }
  catch { setData(d => d && ({ ...d, matrix: { ...d.matrix, [role]: { ...d.matrix[role], [key]: !next } } })); setError('Не удалось сохранить'); }
}
// render: <table> rows grouped by resource; columns roles; checkbox disabled when role==='super_admin'
```

- [ ] **Step 2: Verify on dev server (Playwright)**

Run: `node /tmp/shot.mjs /admin/roles` (login + screenshot). Confirm matrix renders, toggling persists (reload page → state kept), zero console errors. Read `/tmp/shot-admin_roles.png`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/roles/index.tsx
git commit -m "feat(rbac): editable permission matrix UI in /admin/roles"
```

---

## Phase R3 — Load dept/object roles (optional, related fix)

### Task 9: Populate departmentRoles/objectRoles on auth

**Files:**
- Modify: `backend/src/middleware/auth.ts` (or `rbac.ts` authMiddleware)
- Modify: `backend/src/repositories/users.ts` (add loaders)

- [ ] **Step 1: Add repository loaders**

```typescript
// users.ts
export async function findDepartmentRoles(userId: string) {
  const { rows } = await pool.query(
    'SELECT department_id AS "departmentId", role FROM department_roles WHERE user_id = $1', [userId]);
  return rows as { departmentId: string; role: 'department_head' | 'member' }[];
}
export async function findObjectRoles(userId: string) {
  const { rows } = await pool.query(
    'SELECT object_type AS "objectType", object_id AS "objectId", role FROM object_roles WHERE user_id = $1', [userId]);
  return rows as { objectType: string; objectId: string; role: 'owner'|'editor'|'viewer' }[];
}
```

- [ ] **Step 2: Make authMiddleware async and populate roles**

In `authMiddleware`, after building `req.user` from the JWT payload, load and attach (skip for super_admin/admin to save queries since they bypass):

```typescript
if (req.user.companyRole !== 'super_admin' && req.user.companyRole !== 'admin') {
  req.user.departmentRoles = await findDepartmentRoles(req.user.id);
  req.user.objectRoles = await findObjectRoles(req.user.id);
}
```

(Convert the middleware signature to `async` and ensure it `await`s before `next()`; verify the existing `requireDepartmentRole`/`requireObjectRole` consumers still type-check.)

- [ ] **Step 3: Verify**

Run: assign a `department_head` row for a non-admin user, hit a `requireDepartmentRole`-gated route, expect pass; remove it, expect 403.

- [ ] **Step 4: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/repositories/users.ts
git commit -m "fix(rbac): load department/object roles into req.user on auth"
```

---

## Final: rebuild + deploy

- [ ] Rebuild local prod: `docker compose build backend frontend && docker compose up -d backend frontend`; verify `/admin/roles` at :8080 and enforcement.
- [ ] Deploy to VPS after merge: `ssh root@158.255.1.165 'cd /opt/ai-portal && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build'`.

## Self-Review
- **Spec coverage:** capability catalog (Task 1) ✓; role_permissions table+seed (Task 2) ✓; permissionService+can (Task 3) ✓; requirePermission (Task 4) ✓; GET admin+ / PATCH role.manage API (Task 5) ✓; enforce on mutations (Task 6) ✓; matrix UI (Tasks 7-8) ✓; dept/object loading R3 (Task 9) ✓. No gaps.
- **Placeholders:** route-handler bodies in Task 6 reference existing handlers (kept intact); admin-api helpers note "match existing helper names" — the executor must read `admin-api.ts` first. No fabricated symbols.
- **Type consistency:** `can(role, capability)`, `setAllowed`, `requirePermission(capability)`, `getPermissions`/`updatePermission`, `PermissionMatrix` used consistently across tasks.
