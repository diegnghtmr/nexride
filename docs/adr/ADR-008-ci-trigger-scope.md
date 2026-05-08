# ADR-008 — Intentional CI Trigger Scope

**Date:** 2026-05-06  
**Status:** Amended (2026-05-08, v0.1.18-mvp) — see Amendment section  
**Finding:** F5 (rubric-residuals-v8 audit) → reopened by judgment 17° F9 (stale citation)

---

## Context

The `.github/workflows/ci.yml` pipeline is triggered only on:
- `push` to `main`
- `tags` matching `v*`
- `pull_request` targeting `main`

Feature branches that are not yet in a PR do not trigger CI.

During the v8 rubric audit (finding F5), this was flagged as a potential gap:
no CI feedback on work-in-progress branches until a PR is opened.

---

## Decision

**Keep the current trigger scope.** Feature-branch CI is intentionally absent.

### Rationale

1. **GitHub Actions billing.** Every workflow run on every push to every
   feature branch multiplies billing minutes with zero additional signal
   beyond what the developer gets from local tooling (`npm run ci:local`).

2. **Signal-to-noise tradeoff.** WIP branches are frequently in a broken state
   by design (RED commits in TDD, stubs, work-in-progress). Failing CI on
   every intermediate commit pollutes the checks UI and trains developers to
   ignore CI red.

3. **PR-time coverage is sufficient.** CI runs on PR open and on every
   subsequent push to the PR branch — this is the merge gate. The relevant
   question is not "does CI run on my branch?" but "does CI gate the merge?"
   It does.

4. **Local reproducibility.** `npm run ci:local` (`scripts/ci-local.sh`)
   mirrors all blocking CI jobs locally. Developers are expected to run it
   before opening a PR.

---

## Consequences

- Developers must run `npm run ci:local` before pushing a PR.
- CI failures are surfaced at PR time, not at push time on feature branches.
- No behavioral change to the pipeline or triggers.

---

## Deferred

Re-evaluation of feature-branch CI triggers is deferred to **v0.1.9-mvp**.
At that point, if billing budget allows, a lightweight check (lint + typecheck
only, no Testcontainers) on feature-branch pushes may be considered.

---

## Amendment (v0.1.18-mvp, 2026-05-08) — judgment 17° F9 closure

**The original decision is reversed.** `ci.yml` triggers on `push:` (any branch) plus `pull_request: branches: [main]`. The change happened implicitly when the repo went **public** during the v0.1.15-mvp cycle (judgment 14° v15 close-out): Actions minutes are now unlimited, so the original billing rationale (point 1) no longer applies. Points 2-4 of the original Decision are technical preferences, not constraints — and PR-time + every-push parity is strictly more signal at zero marginal cost.

**Current effective behavior** (matches `ci.yml:3-7`):
- `push:` — any branch (no filter)
- `pull_request:` — targeting `main`

**Trade-off accepted**: WIP branches now show CI red on intermediate commits. This is mitigated by:
- Local `npm run ci:local` still expected before pushing.
- Strict TDD pattern (RED → GREEN sequential commits) — RED commits will fail CI by design; this is now a documented expected state, not a regression.

**Why amend, not supersede**: the original *intent* (cost-efficient gating) is preserved; only the cost premise changed. Future readers should understand that the trigger scope evolved with the repo's billing model, not with the project's testing philosophy.

---

## References

- `.github/workflows/ci.yml` — trigger definition (current: lines 3-7)
- `scripts/ci-local.sh` — local CI reproducibility wrapper
- `SCOPE.md §5` — ADR summary table
- Engram archive `sdd/judgment-15-residuals/archive-report` — repo public decision
- Judgment 17° finding F9 — drove this amendment
