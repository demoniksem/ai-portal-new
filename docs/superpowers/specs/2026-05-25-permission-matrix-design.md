# Permission Matrix (role × capability) — Design Spec

**Date:** 2026-05-25
**Project:** ai-portal-final (branch `feat/ai-portal-redesign-and-fixes`)
**Status:** Approved (approach A — DB-editable matrix + `requirePermission` enforcement)

## Problem

The portal has a 3-tier role model (company `super_admin/admin/employee/guest`;
department `department_head/member`; object `owner/editor/viewer`) with middleware
`requireRole/requireAdmin/requireObjectRole`. But enforcement is **sparse and coarse**:
only a few admin routes (`admin`, `aiConfig`, `departments`) are role-gated; most CRUD
(boards, cards, pages, spaces) is open to **any authenticated user**. There is no granular,
editable notion of "which role may perform which action." Goal: a granular
**capability** layer (resource × action), an **editable matrix** mapping roles → capabilities,
**enforcement** via middleware, and an **admin matrix UI**.

### Grounding (current state)
- Roles: PG enum `company_role_level` = `super_admin | admin | employee | guest`. JWT carries `companyRole`.
- Enforcement: `backend/src/middleware/rbac.ts` — `requireRole(...)`, `requireAdmin`, `requireSuperAdmin`,
  `requireDepartmentRole`, `requireObjectRole`. super_admin/admin bypass dept/object checks.
- **Latent bug (related, R3):** `authMiddleware` sets `req.user.departmentRoles = []` and
  `objectRoles = []` (never loaded), so dept/object checks always deny non-admins. Out of R1/R2 scope; addressed in R3.
- Routes: `boards.ts`, `cards.ts`, `pages.ts`, `spaces.ts`, `departments.ts`, `admin.ts`, `aiConfig.ts`.
- Frontend `/admin/roles` page exists (`pages/admin/roles/index.tsx`) → becomes the matrix UI.

## Approach (A)
DB-stored, editable role→capability matrix; `requirePermission(capability)` enforces against the
user's company role; super_admin always allowed. Object/department scoping stays as-is (separate concern).

## Out of scope
- Per-object permission overrides (the existing `object_roles` table is separate; R is company-role × capability).
- Custom roles beyond the 4 fixed roles.
- Field-level permissions.

---

## Capability catalog (code-defined constants)
`resource.action` strings, grouped:
- **space:** `space.create`, `space.read`, `space.update`, `space.delete`
- **page:** `page.create`, `page.read`, `page.update`, `page.delete`
- **board:** `board.create`, `board.read`, `board.update`, `board.delete`
- **card:** `card.create`, `card.update`, `card.delete`, `card.move`
- **column:** `column.manage` (create/update/delete/reorder)
- **admin:** `user.manage`, `department.manage`, `role.manage`, `aiconfig.manage`, `brand.manage`

The catalog is the single source of truth (one module, e.g. `backend/src/rbac/capabilities.ts`),
imported by the seed, the middleware, and surfaced to the UI via API.

## Default matrix (seeded; editable afterwards)
| capability group | super_admin | admin | employee | guest |
|---|---|---|---|---|
| space/page/board read | ✓ | ✓ | ✓ | ✓ |
| space/page/board/card create+update, card.move, column.manage | ✓ | ✓ | ✓ | ✗ |
| space/page/board/card delete | ✓ | ✓ | ✗ | ✗ |
| user/department/aiconfig/brand manage | ✓ | ✓ | ✗ | ✗ |
| role.manage (edit this matrix) | ✓ | ✗ | ✗ | ✗ |

`super_admin` always has every capability (column locked in UI, bypass in middleware).

## Data model
Idempotent in `db/init.ts`:
```
CREATE TABLE IF NOT EXISTS role_permissions (
  role company_role_level NOT NULL,
  capability VARCHAR(64) NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role, capability)
);
```
Seed from the default matrix on init if empty (per role × capability). New capabilities added to the
catalog are seeded with their default on next init (insert-if-missing).

## Enforcement
- `permissionService`: loads `role_permissions` into an in-memory map at startup; `can(role, capability)`
  returns boolean (super_admin → always true). `reload()` called after any matrix update (and a version
  counter so multi-instance can poll later if needed).
- `requirePermission(capability)` middleware: 401 if unauthenticated; `can(companyRole, capability)` else 403
  + `auditService.logPermissionDenied`.

## API (admin)
- `GET /api/admin/permissions` → `{ capabilities: [{key, resource, action, label}], roles: [...], matrix: {role: {capability: bool}} }` (gated `requireAdmin` — admin+ may **view** the matrix).
- `PATCH /api/admin/permissions` → body `{ role, capability, allowed }` (or bulk); validates against catalog;
  rejects edits to `super_admin`; updates row + `permissionService.reload()` (gated `requirePermission('role.manage')` — super_admin **edits**).

---

## Phase R1 — Backend foundation ⭐ critical
- Capability catalog module + types.
- `role_permissions` table + idempotent seed of defaults.
- `permissionService` (load/cache/can/reload) + `requirePermission(cap)` middleware.
- Apply `requirePermission` to mutation routes: spaces, pages, boards, cards, columns (create/update/delete/move),
  keeping existing admin/aiConfig/department gating (mapped to `*.manage` capabilities).
- `GET`/`PATCH /api/admin/permissions`.
- **Acceptance:** a guest token is 403 on `board.create`; employee 403 on `board.delete`; admin allowed;
  toggling a capability off via PATCH immediately denies it (cache reloaded).

## Phase R2 — Admin matrix UI ⭐ high
- `pages/admin/roles/index.tsx` → permission matrix: rows = capabilities grouped by resource,
  columns = 4 roles, checkboxes; `super_admin` column shown all-checked + disabled.
- Load `GET /api/admin/permissions`; toggling a cell `PATCH`es + optimistic update + save feedback;
  loading/empty/error states; taste-skill design (tokens, motion).
- **Acceptance:** changing a checkbox persists and is reflected in enforcement on next request.

## Phase R3 — Load dept/object roles (related fix) ◆ optional
- Populate `req.user.departmentRoles` / `objectRoles` in `authMiddleware` (load from DB on auth, or
  embed in JWT), so `requireDepartmentRole`/`requireObjectRole` work for non-admins.
- **Acceptance:** a department_head passes a `requireDepartmentRole` check for their department; a non-member is denied.

## Cross-cutting
- Design: matrix UI uses design-system tokens + `taste-skill` (single accent, no purple, Russian copy).
- Verification: backend via API calls (curl with different-role tokens) + the `:3009` dev server;
  UI via Playwright screenshot (login + `/admin/roles`, zero console errors); final `:8080` rebuild.
  Prod (`158.255.1.165`) updated via `git pull` + rebuild after merge.
- Migration additive/idempotent; no destructive changes.
- Sequencing R1 → R2 → R3; each independently mergeable.
