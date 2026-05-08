# ADR-012 — Branch Protection: Admin Bypass Policy

**Date:** 2026-05-08
**Status:** Accepted
**Finding:** Judgment 20° F6 — drove the formalization

---

## Context

Branch protection on `main` was enabled in v0.1.19-mvp (judgment 18° F-CRITICAL closure) with:

- 7 required status checks (`lint-typecheck`, `architecture-rules`, `unit-tests`, `integration-tests`, `performance-smoke`, `security-static`, `build-openapi`)
- `strict = true` (PRs must be up to date with `main` before merging)
- `allow_force_pushes = false`
- `allow_deletions = false`
- **`enforce_admins = false`** ← this ADR

Repository owners with `admin` role can therefore push directly to `main` while bypassing the 7 checks. The remote already logs every such push as `remote: Bypassed rule violations for refs/heads/main`.

A judgment 20° finding (F6) flagged this as "rule theater" — the 7 required checks are not real gates if the admin can bypass them at will.

---

## Decision

Keep `enforce_admins = false`, but **constrain the bypass to a single, mechanical use case**: the post-merge tag-bump commit.

### Allowed via bypass

ONLY `chore(release): bump v0.1.X-mvp …` commits that:

1. Modify exclusively `package.json` (version field) and `docs/rubric-checklist.md` (header lines + tag-bump cells).
2. Land immediately after a feature/fix PR is squash-merged into `main`.
3. Pass the local pre-flight grep (`grep -nP 'v0\.1\.[0-9]+-mvp' README.md SCOPE.md docs/rubric-checklist.md | grep -ivP 'histór|original|previous|superseded|ADR-004|v0\.1\.0|→|históricamente'` returns empty).
4. Are followed within the same session by `git tag -a v0.1.X-mvp` + tag push, gated by tag-CI.

### Forbidden via bypass

EVERYTHING ELSE. Specifically:

- Any change to `src/`, `test/`, `scripts/`, `.github/workflows/`.
- Any change to `SCOPE.md`, `README.md`, ADRs, design docs.
- Any `.env.example` change.
- Any `package.json` change OTHER than the `version` field.

These MUST go through a PR with the 7 required checks green.

### Rationale

1. **Tag-bumps are zero-risk by construction.** They cannot introduce code, tests, or contract drift — only metadata. Running 7 checks (≈3.5 min CI) for a 2-line metadata change has negligible value vs. the friction of opening a PR for every release.
2. **Pre-flight grep is the real gate.** The tag-CI guard regex (`histór|original|previous|superseded|ADR-004|v0\.1\.0|→|históricamente`) is enforced on every tag push by `scripts/verify-doc-consistency.sh` Check 3. A bad bump fails the tag-CI run and forces a hotfix PR (this happened once, judgment 17° → hotfix #46 — proving the gate is real).
3. **The 11-cycle history shows zero misuse.** Tag-bumps v0.1.10..v0.1.20 all followed pattern (1)-(4). No code change ever rode a bypass commit. The discipline already exists; this ADR codifies it.

---

## Consequences

- The `Bypassed rule violations` log line is **expected** for every `chore(release)` commit and is NOT a security incident.
- Any other bypass MUST be reported as a deviation from this ADR, with justification in the next archive observation.
- If at any point a contributor without `admin` role joins, this ADR's bypass policy stops applying to them automatically (they cannot bypass at all). No code change needed — GitHub enforces the role gate.

---

## Alternatives considered

1. **Set `enforce_admins = true`.** Rejected: forces the admin to open a PR for every 2-line tag-bump, multiplying churn ×11 over the cycle history. Cost > value.
2. **Use a separate `release` branch with relaxed rules.** Rejected: adds branch topology complexity for zero contract benefit. The pre-flight grep + tag-CI guard is already strict.
3. **Sign tag-bump commits with a CI bot to attribute them differently.** Rejected: out of scope for an MVP and conflicts with the project rule of no AI/automation attribution in commits.

---

## References

- `gh api repos/{owner}/{repo}/branches/main/protection` — current protection state.
- `scripts/verify-doc-consistency.sh` — the real tag-CI guard (Check 3).
- Judgment 17° finding (post-public-repo) — first time bypass was used post-protection.
- Judgment 18° hotfix #46 — proof the tag-CI guard catches bad bumps, even when the bypass landed.
- Engram archive `sdd/judgment-18-residuals/archive-report` (obs #1213) — original branch-protection-applied event.
- Judgment 20° finding F6 — drove this ADR.
