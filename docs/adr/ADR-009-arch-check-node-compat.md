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
  everything else. Repo already declares `"node": ">=20.0.0 <23.0.0"` in
  `package.json` which is intentionally permissive.
- **Upgrade to a depcruise version that supports Node ≥22**: at the time of
  writing (v16.4.0), no such version exists. This is tracked in the TODO above.
