# ADR-009 — arch:check Node version constraint

Status: Accepted
Date: 2026-05-07

## Context

`dependency-cruiser` (v16.4.0) uses `--experimental-vm-modules` flags and AST
APIs that are stable on Node 20 but break on Node ≥22 (CommonJS/ESM resolver
changes, vm context isolation differences). The `test/architecture/dispatch-
isolation.spec.ts` integration test detects the Node major version and skips
gracefully on Node ≥22. CI pins Node 20 and enforces the check; local devs are
typically on Node 24/25, so the skip masks regressions during development.

The constraint is: `depcruise requires Node ≤21` for the architecture check to
execute correctly in this project configuration. The CI `architecture-rules` job
runs on `node-version: 20` and is the authoritative gate for every PR.

## Decision

1. CI is the source of truth: Node 20 runners enforce `arch:check` on every PR.
2. Local devs get an actionable skip message pointing at two repro paths:
   - `nvm use 20 && npm run arch:check` (preferred, fastest).
   - `npm run arch:check:docker` (no nvm needed, slower first run).
3. `arch:check:docker` is available as `npm run arch:check:docker` — runs depcruise
   inside `node:20-alpine` with the current working directory mounted.
4. ADR-009 is referenced from README "Running architecture checks locally".
5. Re-evaluate when depcruise publishes a release with Node ≥22 support.

## Consequences

+ Local false-greens are no longer silent — every skip prints the remedy.
+ Docker fallback covers Windows-without-WSL and devs avoiding nvm.
- Adds a `docker` runtime dependency for one optional script.
- ADR must be revisited when depcruise upgrades; tracked via TODO in this file.

## TODO

- [ ] Track depcruise releases for Node ≥22 support. When available, update
  `.dependency-cruiser.cjs`, remove the Node-major guard from
  `test/architecture/dispatch-isolation.spec.ts`, and archive this ADR.

## Rejected alternatives

- **Remove the skip and fail loudly on Node ≥22**: would break every local dev
  env that uses Node 24/25 for other work. The skip is correct; only its UX
  was bad before this ADR.
- **Pin engines to Node 20 only**: blocks devs from using newer Node for
  everything else. Repo declares `"node": ">=20.0.0 <22.0.0"` in
  `package.json` which is intentionally permissive up to (but not including) Node 22.
- **Upgrade to a depcruise version that supports Node ≥22**: at the time of
  writing (v16.4.0), no such version exists. This is tracked in the TODO above.

## Amendment — v0.1.12-mvp engines tightening

`package.json` engines tightened from `<23.0.0` to `<22.0.0` to match the
supported matrix documented in this ADR. Reason: rubric review v11 (F4) flagged
the discrepancy as a contributor-onboarding footgun — allowing Node 21 and 22 in
engines while CI and arch:check only run Node 20 creates a false expectation that
those versions are validated. Históricamente the cap was loose because Node 22 was
expected to be validated by v0.1.10-mvp; that validation was deferred and the
rubric residuals pass enforces consistency now.

## Amendment — v0.1.22-mvp Node 22 validated; skip threshold lifted to Node ≥23

After judgment 20° F1 raised every CI job to `node-version: 22` and judgment 21°
flagged the documentation drift (this ADR still said "Node 20 source of truth"),
we re-validated empirically:

- **depcruise 16.4.0 LOADS and RUNS correctly on Node 22.** The R_OK named-export
  break only happens on Node ≥23 (where `node:fs` ESM exports changed). CI Node 22
  passes the `architecture-rules` job using `npx depcruise --config ...
  --output-type err src` directly.
- **The Jest spec `test/architecture/dispatch-isolation.spec.ts` previously
  skipped on Node ≥22**, which produced false PENDING in CI Node 22 — losing the
  signal of the integration check (the spec also performs a deliberate-violation
  self-test that the direct CLI invocation does NOT cover).
- Skip threshold tightened from `NODE_MAJOR >= 22` to `NODE_MAJOR >= 23`. CI Node
  22 now runs both assertions (zero violations + deliberate-violation detection).
  Local devs on Node 24/25 still get the actionable PENDING with remedy pointing
  at `arch:check:docker`.
- `package.json` engines remain at `>=22.12.0 <25.0.0` (set by judgment 20° F2).
  The cap stays at <25 to mirror what is actually validated; Node 25 devs are
  blocked from `npm install` by `engines` and routed to `arch:check:docker`.
- depcruise 17.4 explicitly supports `^20.12 || ^22 || >=24` and resolves the
  Node ≥23 break entirely; upgrade tracked as follow-up but **not blocking**
  since CI Node 22 already enforces the gate.

CI source of truth, post-amendment: **Node 22 with depcruise 16.4 — both the
direct CLI and the Jest integration spec exercise the architecture rules.**

## Amendment — v0.1.22-mvp arch:check:docker base image alignment

`arch:check:docker` previously used `node:20-alpine` because that matched CI at
the time of writing. Since CI now runs Node 22, the docker base is updated to
`node:22-alpine` to match. The `--ignore-scripts` and `--engine-strict=false`
flags are not needed in the container because the container's Node is inside
the engines range. This removes the EBADENGINE error that local devs would hit
when running `npm run arch:check:docker` after judgment 20° tightened the
engines field.
