# ADR-013 — PATCH Response Body Bug: Root Cause and Resolution

**Date:** 2026-05-08
**Status:** Resolved (S1 closed)
**Finding:** Judgment 20° F7 — drove the formal investigation and fix

---

## Context

A backlog item labelled `S1 — NestJS PATCH response body serialization gap` was carried in next-step lists from v0.1.10-mvp through v0.1.20-mvp (11 release cycles) without:

- An ADR explaining what the gap was.
- A reproducing test case.
- A pinned line in the codebase indicating where the gap manifests.

The judgment 20° F7 finding forced a resolve-or-retire investigation. Initial assumption was that S1 might be a phantom (item carried by inertia). **It is not a phantom — it is a real bug**. The investigation produced the test that finally reproduces it, and this ADR documents the root cause and the fix.

---

## Investigation

A new integration spec (`test/integration/safe-points/safe-points.patch-response-body.spec.ts`) asserts the full response body contract for the 3 PATCH endpoints. On the first run against the v0.1.20-mvp codebase, the response from `PATCH /safe-points/:id` came back as:

```json
{
  "safetyScore": null,
  "location": { "lat": null, "lng": null }
}
```

— missing `id`, `name`, `zoneId`, `reason`, `status`, `createdAt`, `updatedAt`, and with `safetyScore` + `location` coerced to `null`. The same shape was returned by `PATCH /:id/activate` and `PATCH /:id/deactivate` because they all delegate to `SafePointsRepository.update`.

### Root cause

`SafePointsRepository.update` (`src/safe-points/infrastructure/safe-points.repository.ts`) used:

```ts
const rows = await runner.query<...>(`UPDATE safe_points SET ... RETURNING ...`, params);
const row = rows[0];   // ← BUG: rows is [rowsArray, affectedCount] for UPDATE...RETURNING
return this.mapRow(row, { lat: parseFloat(row.lat), lng: parseFloat(row.lng) });
```

For `UPDATE...RETURNING` queries, the `pg` driver via TypeORM's `runner.query()` returns a 2-tuple: `[Array<row>, affectedCount]`. The repo treated `rows` as if it were the rows array, so:

- `rows[0]` was `Array<row>` (not the first row).
- `row.id`, `row.name`, etc. were `undefined` → JSON.stringify omits them.
- `row.lat` and `row.lng` were `undefined` → `parseFloat(undefined) === NaN` → JSON.stringify of `NaN` is `null`.
- `row.safety_score` was `undefined` → `parseFloat(undefined) === NaN` → `null` in the response.

That explains exactly the observed shape.

### Why the bug survived 11 release cycles

The existing PATCH integration tests (`safe-points.crud.spec.ts:226-230`, `safe-points.audit.spec.ts`, `safe-points.update-reason.spec.ts`) all assert `.expect(200)` and then verify the change via direct SQL `SELECT`. They **never asserted the response body shape**. So the bug was silent: HTTP status was right, DB state was right, only the payload to the client was malformed.

`create()` and `findById()` and `findWithin()` use `INSERT...RETURNING` / `SELECT` which the `pg` driver returns as a flat array, so they were never affected.

### Why `pg` returns the tuple shape

The `pg` driver returns the raw `pg.QueryResult` object for any non-SELECT statement when using parameterized `runner.query()`. For `RETURNING` clauses on `UPDATE`/`DELETE`, the result wraps the rows in a tuple alongside the affected-row count. This is a well-known TypeORM gotcha when mixing raw SQL and `RETURNING`.

---

## Decision

Fix `SafePointsRepository.update` to correctly unwrap the result shape:

```ts
const result = await runner.query<...>(`UPDATE ... RETURNING ...`, params);
// pg driver returns [rowsArray, affectedCount] for UPDATE...RETURNING.
// SELECT/INSERT...RETURNING return a flat array. Defend against both.
const rows: Array<Row> = Array.isArray(result[0]) ? (result[0] as Array<Row>) : (result as Array<Row>);
```

Add the integration spec as a permanent regression gate. If anyone in the future reintroduces the unwrapping bug, this test catches it before merge.

Also retire S1 from "pendientes vivos" lists in archive observations from v0.1.21-mvp onward. The bug is fixed and the regression gate is in place.

---

## Consequences

- The 3 PATCH endpoints now return the full updated `SafePoint` shape — `id`, `name`, `zoneId`, `reason`, `safetyScore`, `status`, `location.{lat,lng}`, `createdAt`, `updatedAt`.
- Clients that depended on the old (broken) shape would now break — but no such clients exist (the MVP has no production API consumers; OpenAPI was always documented as the full shape).
- The defensive `Array.isArray(result[0])` check makes the repo resilient to driver-version differences (some `pg` versions return a flat array even for UPDATE).

---

## Lessons

1. **A backlog item carried for ≥3 cycles without ADR or reproduction must trigger a resolve-or-retire cycle.** Inertia turns silent bugs into permanent debt.
2. **Status assertions + DB-state assertions are not enough.** Response body shape must be asserted in integration tests of every endpoint that returns a domain object.
3. **Phantom assumption was wrong.** The investigation started believing S1 was a phantom carried by inertia; the test proved it real. Always run the test before believing the absence.
4. **`pg` raw query result shape varies by statement type.** When using raw SQL via TypeORM, defensive `Array.isArray(result[0]) ? result[0] : result` is the safe pattern.

---

## References

- `test/integration/safe-points/safe-points.patch-response-body.spec.ts` — the test that exposed the bug and now guards against regression.
- `src/safe-points/infrastructure/safe-points.repository.ts` — the fixed `update` method.
- `src/safe-points/safe-points.controller.ts:73,93,109` — the 3 PATCH handlers covered by the fix.
- Engram archives v0.1.10-mvp through v0.1.20-mvp — every `Next steps` section that mentioned S1 (now retirable).
- Judgment 20° finding F7 — drove this closure.
