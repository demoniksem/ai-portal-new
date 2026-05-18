#!/bin/bash
# Test coverage report generator for AI Portal
# Run from project root: ./scripts/coverage-report.sh
# Or from backend/frontend: npm run test:coverage

set -e

BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"

echo "=========================================="
echo "AI Portal Test Coverage Report"
echo "=========================================="
echo ""

# Backend coverage
echo ">>> Backend: Jest + Supertest"
echo "--------------------------------------"
cd "$BACKEND_DIR"
JWT_SECRET=test-secret npm test -- --coverage --coverageThreshold='{"global":{"branches":10,"functions":10,"lines":10,"statements":10}}' 2>&1 | grep -E "Coverage|Tests:|PASS|FAIL|All files" | head -30

echo ""
echo ">>> Frontend: Jest + React Testing Library"
echo "--------------------------------------"
cd "$FRONTEND_DIR"
NODE_ENV=test npm test -- --coverage --coverageThreshold='{"global":{"branches":10,"functions":10,"lines":10,"statements":10}}' 2>&1 | grep -E "Coverage|Tests:|PASS|FAIL|All files" | head -30

echo ""
echo "=========================================="
echo "Coverage thresholds: minimum 10% (initial)"
echo "Run npm test -- --coverage for full HTML report"
echo "=========================================="
