# Dispatch reference

## API flow

`POST /rides/request` searches Redis fleet snapshots and PostGIS pickup candidates in parallel, filters candidates, ranks the remaining vehicle and pickup pairs, and persists a preliminary decision with scores. The original pickup remains an option. `POST /rides/confirm` accepts the request ID and choice, locks the preliminary decision, and records the assignment with the pickup type and suggested-point ID when applicable. Events reach the analytics module after the transaction commits. See the [traceability matrix](traceability-matrix.md) for implementation and test paths for RTF-14 through RTF-32.

## Design decisions

1. **ADR-001 — Distance adapter.** `HaversineDistanceProvider` estimates ETA at 25 km/h and caches estimates in Redis for 60 seconds by default. Set `DISTANCE_INJECT_TIMEOUT=true` for deterministic timeout testing. A route-aware provider can replace the adapter at the `IDistanceProvider` binding without changing scoring logic.
2. **ADR-002 — Flag adapter.** `LocalFlagProvider` resolves dot-separated keys through `ConfigService`. A feature-flag service could implement the same port; current weights and thresholds come from process configuration and changes require a restart.
3. **ADR-003 — Test identity instead of JWT/OTP.** Rider and safe-point endpoints use an identity supplied by a test-only guard in non-production mode, with `TEST_CONTEXT_GUARD_ENABLED=true`. The guard is disabled by default and refuses production use. See the [security review](security/owasp-top-10-review.md) for the role contract and scope boundary.
4. **ADR-004 (superseded) — k6 threshold history.** The initial smoke gate allowed additional runner overhead. The current CI smoke gate follows the thresholds documented in [scope](../SCOPE.md); its short synthetic workload is not a production or sustained-load benchmark.
5. **ADR-005 — In-process events.** `EventEmitter2` handles named dispatch and trip events without deploying a broker. Consumers live in the analytics module. Cancellation is event scaffolding only, not a completed trip lifecycle.

ADRs 006–016 are in [the ADR directory](adr/). For the architecture and product scope rationale, see [Design Doc DD-01](Design%20Doc%20DD-01%20-%20NexRide.md), [Design Doc DD-02](Design%20Doc%20DD-02%20-%20NexRide.md), and the [requirements matrix](traceability-matrix.md).

## Local verification

Use Node 22 for `npm run arch:check`. The architecture Jest spec skips on newer Node lines where dependency-cruiser 16.4 is incompatible; see [ADR-009](adr/ADR-009-arch-check-node-compat.md). The manifest's Docker wrapper installs only production dependencies, so prefer running the normal command in a Node 22 environment with the development dependencies installed.

`npm run lint:fix` applies ESLint fixes. Use `npm run test:unit -- --coverage` or `npm run test:cov` for coverage. `npm run ci:local` runs the local lint, types, documentation, environment example, architecture, coverage, integration, and audit checks, and runs `npm run gitleaks` if the scanner is installed. It does not replicate the k6 job or the OpenAPI generation job. Install Docker for the default Testcontainers integration setup. `npm run audit` audits the production dependency tree at high severity; the development tree is not covered by that check. See [ADR-007](adr/ADR-007-security-gate-snyk-alternative.md).
