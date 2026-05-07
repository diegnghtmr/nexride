# ADR-008 — Intentional CI Trigger Scope

**Date:** 2026-05-06  
**Status:** Accepted  
**Finding:** F5 (rubric-residuals-v8 audit)

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

## References

- `.github/workflows/ci.yml` — trigger definition
- `scripts/ci-local.sh` — local CI reproducibility wrapper
- `SCOPE.md §5` — ADR summary table
