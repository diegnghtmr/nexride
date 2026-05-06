# ADR-007 — Security Gate: gitleaks + npm audit as Snyk Alternative

**Date**: 2026-05-06
**Status**: Accepted — 2026-05-06

---

## Context

TRD §407 and §414 prescribe Snyk + npm audit as the security gate composition for the CI/CD pipeline. Snyk requires a `SNYK_TOKEN` (SaaS account credential) to operate. The project decision is to not introduce a SaaS-vendor dependency for the MVP academic deliverable — external token dependencies complicate reproducibility and create a runtime requirement for secret management that is out of scope for this phase.

A documented equivalent gate is required to honor the TRD intent (static dependency vulnerability analysis + secrets scanning) without the vendor lock-in.

This ADR was prompted by the completion of the `nexride-nestjs11-migration` change, which (a) eliminated the 7 production-side high-severity CVEs that were deferred under ADR-006 and (b) returned the audit gate to `--audit-level=high` as prescribed by `docs/guia-implementacion.md` §CT-07.

---

## Decision

Adopt the following pair as the equivalent security gate (both run blocking on every PR):

1. **`gitleaks`** (secret scanning) — runs in the `security-static` CI job via `gitleaks/gitleaks-action@v2`. Covers the secrets-in-code dimension that Snyk's "Snyk Code" product addresses. Requires full git history (`fetch-depth: 0`), which is already configured in the `security-static` job.

2. **`npm audit --audit-level=high --omit=dev`** (dependency vulnerability scanning) — runs in the `audit` CI job. Covers the dependency CVE dimension that Snyk's "Snyk Open Source" product addresses. Post-NestJS-11 migration, this gate exits 0 (zero highs in production dependencies).

Both gates run on every PR and block merge on failure.

---

## Consequences

### Positive

- Covers Snyk's two main dimensions: secrets-in-code AND dependency CVEs.
- No external SaaS dependency; fully reproducible from the repository alone with no token requirements.
- `npm audit` uses the official npm advisory database — the same data source that any dependency scanner (including Snyk) builds upon.
- `gitleaks` provides deterministic secret pattern matching with a well-maintained ruleset.
- Zero operational cost for the MVP academic scope.

### Limitations

- **License-compliance scanning**: Snyk's license analysis feature is NOT covered by this gate. Acceptable for MVP academic scope; if commercial productization occurs, license scanning becomes a follow-up requirement.
- **Centralized vulnerability dashboard**: No continuous monitoring dashboard outside of per-CI-run output. Developers must check PR checks or run `npm audit` locally. Acceptable for the current team size and scope.
- **Transitive depth**: `npm audit` covers the full dependency tree; gitleaks covers committed code. Neither provides Snyk's SBOM export capability. Out of scope for MVP.

---

## References

- TRD §407: prescribes Snyk + npm audit in the CI pipeline
- TRD §414: prescribes automated dependency analysis (npm audit + Snyk) as a merge-blocking gate
- `docs/adr/ADR-006-cve-deferrals.md` — historical context for why a stronger audit gate matters; now superseded by this migration
- SDD change: `sdd/nexride-nestjs11-migration`
- `docs/guia-implementacion.md` §CT-07 — prescribes `--audit-level=high` as the project standard
