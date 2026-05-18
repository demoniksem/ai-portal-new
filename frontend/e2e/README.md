# E2E Tests — AI Portal

Playwright-based end-to-end tests for the AI Portal frontend.

## Prerequisites

Services must be running (via docker-compose):

```bash
cd ai-portal
docker-compose up -d
```

Or run backend + frontend directly on ports 3001 and 3000.

## Setup

```bash
cd frontend
npm install           # already done
npx playwright install --with-deps chromium
```

## Running Tests

```bash
# All E2E tests (Chromium only)
npx playwright test

# With UI (headed)
npx playwright test --headed

# Specific file
npx playwright test e2e/auth.spec.js

# Debug mode
npx playwright test --ui
```

## Test Files

| File | Coverage |
|------|----------|
| `e2e/auth.spec.js` | Login form rendering, valid/invalid login, logout |
| `e2e/navigation.spec.js` | Auth redirects, authenticated page access |
| `e2e/spaces.spec.js` | Spaces API + page load |

## Environment Variables

Set in `frontend/.env.test`:

```env
E2E_BASE_URL=http://localhost:3000
E2E_BACKEND_URL=http://localhost:3001
E2E_ADMIN_EMAIL=admin@portal.com
E2E_ADMIN_PASSWORD=admin123
```

## CI Mode

```bash
CI=true npx playwright test
```
- Enables screenshots/videos on failure
- Enables retries (2x)
- Forbids `test.only`
