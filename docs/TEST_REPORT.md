# AI Portal — Test Report

**Date:** 2026-04-03  
**Tester:** AI Portal QA Subagent  
**Environment:** Docker Compose (5 сервисов)

---

## 1. Container Status

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| All 5 containers Up | backend, frontend, postgres, redis, meilisearch Up | All 5 services running (Up 3-18 min) | **PASS** |

---

## 2. Auth API Tests

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| POST /api/auth/register (valid) | 201 + token + user object | 201 + token + {id:3, email:"test@test.com"} | **PASS** |
| POST /api/auth/login (valid) | 200 + token + user object | 200 + token + {id:3, email:"test@test.com"} | **PASS** |
| POST /api/auth/login (wrong password) | 401 + error message | 401 + {"error":"Invalid credentials"} | **PASS** |
| GET /api/pages (invalid token) | 403 + error message | 403 + {"error":"Invalid or expired token"} | **PASS** |
| POST /api/auth/register (empty email) | 400 + error message | 400 + {"error":"Email and password are required"} | **PASS** |
| POST /api/auth/register (duplicate) | 409 + error message | 409 + {"error":"User already exists"} | **PASS** |
| GET /api/pages (no token) | 401 + error message | 401 + {"error":"No token provided"} | **PASS** |

---

## 3. Pages CRUD Tests

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| POST /api/spaces | 201 + space object | 201 + {id:2, name:"Test Space", slug:"test-space"} | **PASS** |
| GET /api/spaces | 200 + array of spaces | 200 + [{id:2,...},{id:1,...}] | **PASS** |
| POST /api/pages (JSON object content) | 201 + page object | 500 + {"error":"Failed to create page"} | **FAIL** |
| POST /api/pages (stringified content) | 201 + page object | 201 + {id:3, title:"Test Page", content:[...]} | **PASS** |
| GET /api/pages | 200 + array of pages | 200 + [{id:3,...},{id:1,...}] | **PASS** |
| PATCH /api/pages/:id (update title only) | 200 + updated page | 500 + {"error":"Failed to update page"} | **FAIL** |
| DELETE /api/pages/:id | 200 + deleted page object | 200 + {"message":"Page deleted","page":{...}} | **PASS** |

---

## 4. Search Tests

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| GET /api/search?q=Test | 200 + hits array with matching pages | 200 + {hits:[{id:1,title:"Test Page",...}], estimatedTotalHits:1} | **PASS** |
| GET /api/search?q=nonexistent | 200 + empty hits array | 200 + {hits:[], estimatedTotalHits:0} | **PASS** |

---

## 5. AI Build Test

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| POST /api/ai/build (with prompt) | 200 + PageSpec JSON | 200 + fallback spec (mock, OpenClaw exec unavailable in container) | **PASS (degraded)** |

---

## 6. Frontend Tests

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| GET / (home) | 200 + valid HTML with "AI Portal" | 200 + HTML with `<h1>AI Portal</h1>` | **PASS** |
| GET /login | 200 + login form HTML | 200 + HTML with email/password inputs, "Войдите в свой аккаунт" | **PASS** |
| GET /spaces | 200 + spaces page HTML | 200 + HTML with "Загрузка..." (client-side data fetch) | **PASS** |

---

## Summary

| Category | Total Tests | Passed | Failed | Errors | Degraded |
|----------|------------|--------|--------|--------|----------|
| Containers | 1 | 1 | 0 | 0 | 0 |
| Auth API | 7 | 7 | 0 | 0 | 0 |
| Pages CRUD | 7 | 5 | 2 | 0 | 0 |
| Search | 2 | 2 | 0 | 0 | 0 |
| AI Build | 1 | 0 | 0 | 0 | 1 |
| Frontend | 3 | 3 | 0 | 0 | 0 |
| **TOTAL** | **21** | **18** | **2** | **0** | **1** |

**Overall Quality Status: ⚠️ PARTIAL PASS (86% pass rate)**

---

## Bugs Found

### BUG-001: POST /api/pages fails with JSON object content
- **Severity:** HIGH
- **Endpoint:** POST /api/pages
- **Description:** When client sends `content` as a JSON array/object, the PostgreSQL driver (`pg`) fails with `invalid input syntax for type json` (error code 22P02). The driver expects a string for JSONB columns, but receives a JavaScript object.
- **Root cause:** In `/app/src/index.js` line ~226, `content` and `acl` parameters are passed directly to `pool.query()` without `JSON.stringify()`. The `pg` driver does not auto-serialize nested objects for JSONB parameters.
- **Reproduction:**
  ```
  curl -X POST /api/pages -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test","content":[{"type":"text","text":"Hi"}],"spaceId":1}'
  # Returns: {"error":"Failed to create page"}
  ```
- **Workaround:** Client must stringify `content` and `acl` before sending (not a proper fix).

### BUG-002: PATCH /api/pages/:id fails on any update
- **Severity:** HIGH
- **Endpoint:** PATCH /api/pages/:id
- **Description:** Same root cause as BUG-001. When updating a page (even just the title), the handler re-reads `currentPage.content` (which is a JS object from `pool.query`) and passes it directly to the UPDATE query without serialization.
- **Root cause:** In `/app/src/index.js` PATCH handler, `updatedContent` and `updatedAcl` are JavaScript objects from the SELECT result, passed directly to `pool.query()` without `JSON.stringify()`.
- **Reproduction:**
  ```
  curl -X PATCH /api/pages/3 -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Updated"}'
  # Returns: {"error":"Failed to update page"}
  ```

### BUG-003: POST /api/ai/build returns mock data (OpenClaw integration broken)
- **Severity:** MEDIUM
- **Endpoint:** POST /api/ai/build
- **Description:** The `openclaw` CLI is not available inside the Docker container (`/bin/sh: openclaw: not found`), so the AI build endpoint always returns a hardcoded fallback spec instead of generating content from the prompt.
- **Root cause:** The backend container does not have `openclaw` installed or configured. The fallback logic catches the exec error and returns a mock response.
- **Impact:** AI page generation feature is non-functional. Users always receive the same generic template regardless of their prompt.

---

## Recommendations

### HIGH PRIORITY (Fix immediately)

1. **Fix JSON serialization in POST /api/pages and PATCH /api/pages/:id**
   
   In `/app/src/index.js`, wrap `content` and `acl` parameters with `JSON.stringify()`:
   
   ```javascript
   // POST handler (line ~226):
   const result = await pool.query(
     'INSERT INTO pages (title, content, space_id, acl, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
     [title, JSON.stringify(content || {}), spaceId, JSON.stringify(acl || {}), req.user.id]
   );

   // PATCH handler (UPDATE query):
   const result = await pool.query(
     'UPDATE pages SET title = $1, content = $2, acl = $3 WHERE id = $4 RETURNING *',
     [updatedTitle, JSON.stringify(updatedContent), JSON.stringify(updatedAcl), pageId]
   );
   ```
   
   **Alternative:** Use the `pg` driver's built-in JSONB support by passing objects with explicit type casting (`::jsonb`), but `JSON.stringify()` is simpler and more reliable.

2. **Add input validation for content/acl in page endpoints**
   
   Ensure `content` is always an array and `acl` is always an object before serialization. Add defensive checks to prevent malformed data from entering the database.

### MEDIUM PRIORITY

3. **Fix OpenClaw integration for AI Build**
   
   Options:
   - **Option A:** Install `openclaw` CLI inside the backend container (`npm install -g openclaw` or volume-mount the binary)
   - **Option B:** Replace CLI-based integration with HTTP API calls to the OpenClaw gateway (preferred for containerized deployments)
   - **Option C:** Implement a webhook/queue-based async job pattern where the backend publishes a prompt to Redis and a separate worker handles OpenClaw integration

4. **Add proper error messages**
   
   Currently, page creation/update errors return generic `{"error":"Failed to create page"}`. Include the actual database error for debugging (in development mode) or a more descriptive message for production.

### LOW PRIORITY

5. **Add health check endpoint**
   
   Implement `GET /api/health` to report status of PostgreSQL, Redis, and Meilisearch connections. Useful for Docker health checks and monitoring.

6. **Improve search index consistency**
   
   The search index stores `content` as a JSON string (`JSON.stringify(content)`), but users expect structured data. Consider storing content as a separate searchable field or flattening it for better full-text search results.

7. **Add createdAt/updatedAt timestamps to search results**
   
   Current search results only include `id`, `title`, and `content`. Add `created_at` for better result presentation.

---

## Test Execution Details

### Environment
- Docker Compose version: warning about obsolete `version` attribute (cosmetic)
- Backend: Express.js on port 3001
- Frontend: Next.js 16 on port 3000
- Database: PostgreSQL 15 on port 5432
- Cache: Redis 7 on port 6379
- Search: Meilisearch on port 7700

### Test Data Created
- User: `test@test.com` (id=3) — for auth tests
- Space: "Test Space" (id=2, slug: test-space)
- Page: "Test Page" (id=3) — created with stringified content, then deleted

### Notes
- Auth endpoints work correctly with proper validation and error handling
- Frontend renders static HTML correctly (Next.js SSR/SSG)
- The `pg` driver behavior with JSONB parameters is a known gotcha — explicit `JSON.stringify()` is required
- All containers started successfully and remained stable during testing
