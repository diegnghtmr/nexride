#!/usr/bin/env bash
# =============================================================================
# ci-local.sh — Local CI reproducibility wrapper
# =============================================================================
#
# PURPOSE
#   Mirrors the BLOCKING jobs of the GitHub Actions CI suite (excludes
#   performance-smoke and build-openapi which require docker/k6 infra — see
#   INTENTIONALLY EXCLUDED below) so developers can catch failures locally
#   before pushing. Run it before every PR push to avoid red CI.
#
# USAGE
#   npm run ci:local
#   # or directly:
#   bash scripts/ci-local.sh
#
# WHAT THIS RUNS (mirrors CI jobs: lint-typecheck, arch, unit, integration,
#                 security-static, doc-consistency, gitleaks)
#   1. lint          — ESLint over src/ and test/
#   2. typecheck     — tsc --noEmit (strict TypeScript)
#   3. verify-doc-paths     — internal doc link integrity
#   4. verify-doc-consistency — cross-doc consistency gate
#   5. arch:check    — dependency-cruiser bounded-context rules
#   6. test:cov      — unit tests + coverage thresholds (≥85%/≥80%)
#   7. test:integration — integration tests (Postgres + Redis via Testcontainers)
#   8. audit         — npm audit --audit-level=high --omit=dev (0 highs allowed)
#   9. gitleaks      — secret scanning (conditional — see note below)
#
# INTENTIONALLY EXCLUDED
#   performance-smoke (k6)
#     Reason: requires `docker compose up` with the full application stack plus
#     the k6 binary. Running this on every local iteration is too slow and
#     environment-dependent. CI handles it in a dedicated job with Docker infra.
#
#   build-openapi (generate-openapi.ts)
#     Reason: requires a live PostgreSQL database to introspect TypeORM entities
#     and generate the OpenAPI spec. test:integration already spins up a DB via
#     Testcontainers and covers the contract surface; running build-openapi
#     locally would require a separate DB setup with no added value for the
#     local feedback loop.
#
# GITLEAKS NOTE
#   Gitleaks is run in CI via the gitleaks-action GitHub Action (no local
#   binary required). Locally it is optional: install with `brew install gitleaks`
#   (macOS/Linux) or the equivalent package manager. If not installed, this
#   script skips the step and prints a notice — it does NOT fail.
#
# =============================================================================
set -euo pipefail

echo "[ci-local] Starting local CI suite..."
echo ""

echo "[ci-local] Step 1/9: lint"
npm run lint

echo "[ci-local] Step 2/9: typecheck"
npm run typecheck

echo "[ci-local] Step 3/9: verify-doc-paths"
bash scripts/verify-doc-paths.sh

echo "[ci-local] Step 4/9: verify-doc-consistency"
bash scripts/verify-doc-consistency.sh

echo "[ci-local] Step 5/9: arch:check"
npm run arch:check

echo "[ci-local] Step 6/9: test:cov"
npm run test:cov

echo "[ci-local] Step 7/9: test:integration"
npm run test:integration

echo "[ci-local] Step 8/9: audit"
npm run audit

echo "[ci-local] Step 9/9: gitleaks (conditional)"
if command -v gitleaks >/dev/null 2>&1; then
  npm run gitleaks
else
  echo "[ci-local] gitleaks not installed locally — skipping (CI runs it via gitleaks-action)"
fi

echo ""
echo "[ci-local] All steps passed."
