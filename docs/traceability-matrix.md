# Traceability Matrix — NexRide MVP Vertical Slice

> Ordenada por documento fuente. Ver `SCOPE.md` para la misma información ordenada por ID de requisito.

---

## TRD §6 — Requisitos Técnicos Funcionales (RTF)

| TRD Ref | ID | Estado | Evidencia código | Evidencia prueba |
|---|---|---|---|---|
| TRD §6.1 | RTF-01 | Fuera de Alcance — Auth OTP | `src/common/guards/test-context.guard.ts` (ADR-003) | `test/unit/common/guards/test-context.guard.spec.ts` |
| TRD §6.1 | RTF-02 | Fuera de Alcance — Sesiones | — | — |
| TRD §6.1 | RTF-03 | Fuera de Alcance — Registro | — | — |
| TRD §6.2 | RTF-04..08 | Fuera de Alcance — Mobile/UX Rider | — | — |
| TRD §6.3 | RTF-09..12 | Fuera de Alcance — Mobile/UX Driver | — | — |
| TRD §6.4 | RTF-13 | Parcial — fleet read-side con fixtures | `src/fleet/infrastructure/fleet.seed.ts` | `test/integration/fleet/fleet.read.spec.ts` |
| TRD §6.4 | RTF-14 | Implementado | `src/fleet/fleet.service.ts` | `test/unit/fleet/fleet.service.spec.ts` |
| TRD §6.4 | RTF-15 | Implementado | `src/fleet/infrastructure/redis-fleet.adapter.ts` | `test/integration/fleet/fleet.read.spec.ts` |
| TRD §6.5 | RTF-16 | Implementado | `src/dispatch/domain/services/candidate-generator.ts` | `test/unit/dispatch/services/candidate-generator.spec.ts` |
| TRD §6.5 | RTF-17 | Implementado | `src/dispatch/domain/services/candidate-filter.ts` | `test/unit/dispatch/services/candidate-filter.spec.ts` |
| TRD §6.5 | RTF-18 | Implementado | `src/dispatch/domain/services/scoring-engine.ts` | `test/unit/dispatch/services/scoring-engine.spec.ts` |
| TRD §6.5 | RTF-19 | Implementado | `src/dispatch/domain/services/decision-maker.ts` | `test/unit/dispatch/services/decision-maker.spec.ts` |
| TRD §6.5 | RTF-20 | Implementado | `src/dispatch/domain/services/decision-maker.ts` | `test/unit/dispatch/services/decision-maker.spec.ts` |
| TRD §6.5 | RTF-21 | Implementado | `src/dispatch/domain/services/fallback-handler.ts` | `test/unit/dispatch/services/fallback-handler.spec.ts` |
| TRD §6.5 | RTF-22 | Implementado | `src/dispatch/domain/services/decision-recorder.ts` | `test/unit/dispatch/services/decision-recorder.spec.ts`, `test/integration/rides/rides.request.spec.ts` |
| TRD §6.6 | RTF-23 | Implementado | `src/safe-points/safe-points.service.ts` | `test/integration/safe-points/safe-points.crud.spec.ts` |
| TRD §6.6 | RTF-24 | Implementado | `src/safe-points/safe-points.controller.ts` | `test/integration/safe-points/safe-points.rbac.spec.ts` |
| TRD §6.6 | RTF-25 | Implementado | `src/safe-points/infrastructure/safe-point-audit.entity.ts` | `test/integration/safe-points/safe-points.audit.spec.ts` |
| TRD §6.7 | RTF-26 | Parcial | `src/trip/trip.service.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §6.7 | RTF-27 | Parcial | `src/trip/trip.service.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §6.7 | RTF-28 | Implementado | `src/trip/infrastructure/trip.entity.ts`, `src/dispatch/application/confirm-dispatch.use-case.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §6.8 | RTF-29..30 | Fuera de Alcance — Notificaciones/Loyalty | — | — |
| TRD §6.9 | RTF-31 | Implementado | `src/analytics/handlers/dispatch.handler.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §6.9 | RTF-32 | Parcial — scaffolding wire-only (`dispatch.cancelled` sin emit productivo, deferred a RTF-26 post-MVP per ADR-010; históricamente Implementado en v0.1.11..v0.1.12-mvp, reclasificado en v0.1.13-mvp) | `src/analytics/handlers/dispatch.handler.ts`, `src/common/events/event-names.ts` | `test/integration/rides/rides.confirm.spec.ts`, `test/integration/rides/cancel-dispatch.spec.ts` |
| TRD §6.10 | RTF-33..35 | Fuera de Alcance — Ops panel | — | — |

---

## TRD §7 — Requisitos No Funcionales (NFR)

| TRD Ref | ID | Estado | Evidencia código | Evidencia prueba |
|---|---|---|---|---|
| TRD §7.1 | NFR-01 | Implementado — thresholds; perfil divergente documentado (smoke 5VU×30s ≠ 20 req/min sostenidas; ver SCOPE.md y ADR-004 histórico). Históricamente `Implementado` plano hasta v0.1.16-mvp; matizado en v0.1.17-mvp para alinear con SCOPE matiz desde v0.1.15-mvp (residual judgment 16° B6) | `test/performance/rides-request.k6.js` | CI job `performance-smoke` |
| TRD §7.1 | NFR-02..04 | Fuera de Alcance — Infra producción | — | — |
| TRD §7.2 | NFR-05..07 | Fuera de Alcance — Escala producción | — | — |
| TRD §7.3 | NFR-08 | Fuera de Alcance — SLA infra producción | — | — |
| TRD §7.3 | NFR-09 | Implementado | `src/dispatch/infrastructure/providers/haversine-distance.provider.ts` | `test/unit/dispatch/services/haversine-distance-provider.spec.ts` |
| TRD §7.3 | NFR-10 | Implementado | `src/dispatch/application/confirm-dispatch.use-case.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §7.3 | NFR-11 | Fuera de Alcance — Infra producción | — | — |
| TRD §7.4 | NFR-12..14 | Fuera de Alcance — Infra producción | — | — |
| TRD §7.4 | NFR-15 | Parcial — 2 de 3 roles (`supervisor`, `administrador`); `operador` fuera del slice (panel operativo post-MVP). Históricamente `Implementado` hasta v0.1.14-mvp; reclasificado en v0.1.15-mvp para alinear con SCOPE.md y honestidad documental (residual judgment 14° F2 → 15° F1) | `src/common/guards/rbac.guard.ts`, `src/safe-points/safe-points.controller.ts` | `test/integration/safe-points/safe-points.rbac.spec.ts` |
| TRD §7.4 | NFR-16 | Implementado | `src/safe-points/infrastructure/safe-point-audit.entity.ts` | `test/integration/safe-points/safe-points.audit.spec.ts` |
| TRD §7.4 | NFR-17 | Implementado — `src/app.module.ts:60-86` (ThrottlerModule two named throttlers: user 100/min, ip 1000/min), `src/common/guards/configurable-throttler.guard.ts:43-50` (getTracker override: user.id ?? ip) | `test/integration/rides/throttling.spec.ts` (3 scenarios: per-user 429, per-IP 429, unauth not-500) |
| TRD §7.5 | NFR-18 | Implementado | `src/common/observability/pino.config.ts` | Logs JSON visibles en integration tests vía nestjs-pino |
| TRD §7.5 | NFR-19 | Implementado | `src/common/observability/metrics.controller.ts`, `src/common/observability/metrics.registry.ts`, `src/common/observability/observability.module.ts` | `test/integration/observability/metrics-endpoint.spec.ts` |
| TRD §7.5 | NFR-20 | Fuera de Alcance — pipeline alertas post-MVP | `src/common/observability/metrics.registry.ts` (métricas disponibles para scraping) | — |
| TRD §7.5 | NFR-21 | Parcial — SDK instalado, bootstrap pendiente | `package.json` (`@opentelemetry/sdk-node: 0.52.1`) | — |

---

## RFC — Contratos de API

| RFC Ref | Endpoint | Estado | Evidencia código | Evidencia prueba |
|---|---|---|---|---|
| RFC §2.1 | `POST /rides/request` | Implementado | `src/rider/rider.controller.ts`, `src/dispatch/dispatch.facade.ts` | `test/integration/rides/rides.request.spec.ts` |
| RFC §2.2 | `POST /rides/confirm` | Implementado | `src/rider/rider.controller.ts`, `src/dispatch/application/confirm-dispatch.use-case.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| RFC §3.1 | `GET /safe-points/within` | Implementado | `src/safe-points/safe-points.controller.ts` | `test/integration/safe-points/safe-points.crud.spec.ts` |
| RFC §3.2 | `POST /safe-points` | Implementado | `src/safe-points/safe-points.controller.ts` | `test/integration/safe-points/safe-points.rbac.spec.ts` |
| RFC §3.3 | `PATCH /safe-points/:id` | Implementado | `src/safe-points/safe-points.controller.ts` | `test/integration/safe-points/safe-points.audit.spec.ts` |
| RFC §3.4 | `DELETE /safe-points/:id` | Implementado | `src/safe-points/safe-points.controller.ts` | `test/integration/safe-points/safe-points.crud.spec.ts` |

---

## DD-01 — Architecture Decision Document

> **DD-01** covers the modular monolith architecture: NestJS module boundaries, hexagonal domain isolation, in-process event bus, and explicit TypeORM migrations. Cross-references: RTF-16..22 (dispatch pipeline), CAT-04 (architecture rules CI), CT-05..06 (depcruise gates).

| DD-01 Ref | Decisión | Estado | Evidencia |
|---|---|---|---|
| DD-01 §1 | Módulos NestJS con fronteras explícitas | Implementado | `.dependency-cruiser.cjs` + `test/architecture/dispatch-isolation.spec.ts` |
| DD-01 §2 | Dispatch consume fleet/safe-points solo via interfaces | Implementado | `src/common/interfaces/IFleetService.ts`, `ISafePointsService.ts` |
| DD-01 §3 | In-process event bus para analytics | Implementado | `src/common/events/`, `src/analytics/handlers/dispatch.handler.ts` |
| DD-01 §4 | Hexagonal — dominio framework-agnostic | Implementado | `src/dispatch/domain/**` (cero imports @nestjs) |
| DD-01 §5 | Migraciones explícitas TypeORM | Implementado | `src/migrations/` (6 migraciones: EnablePostgis, CreateSafePoints, CreateDispatchDecisions, CreateTrips, CreateAnalyticsEvents, AddDestinationToDispatchDecisions) |

---

## DD-02 — Dispatch Design Document

> **DD-02** covers the dispatch evaluation pipeline design: scoring formula, decision gate, confirmation transaction, IDistanceProvider degradation, and IFlagProvider for runtime weights. Cross-references: RTF-18..22 (scoring + decision + fallback + persistence), DE-04 (walking ≤120m boundary, inclusive — see SCOPE.md §4 for semantic clarification; históricamente `<120m` exclusive hasta v0.1.11-mvp, alineado a `≤120m` inclusive en v0.1.12-mvp matching `ST_DWithin`), NFR-10 (ACID confirm).

| DD-02 Ref | Decisión | Estado | Evidencia |
|---|---|---|---|
| DD-02 §3 | Pipeline EvaluateDispatch: candidatura → filtrado → scoring → decisión → persistencia | Implementado | `src/dispatch/application/evaluate-dispatch.use-case.ts` |
| DD-02 §4 | Config externalizada (pesos, radios, timeouts) | Implementado | `src/common/config/dispatch.config.ts` |
| DD-02 §5 | Fórmulas de score: proximity, energy, safety, continuity | Implementado | `src/dispatch/domain/services/scoring-engine.ts` |
| DD-02 §6 | Suggestion gate: mejora relativa ≥15% AND caminata ≤120m (inclusive, matching `ST_DWithin` per DE-04 v0.1.12-mvp; históricamente `<120m` exclusive hasta v0.1.11-mvp, residual F6 v11/F4 v12) | Implementado | `src/dispatch/domain/services/decision-maker.ts:76` |
| DD-02 §7 | ConfirmDispatch: transacción ACID + SELECT FOR UPDATE (W-5) + eventos | Implementado | `src/dispatch/application/confirm-dispatch.use-case.ts` |
| DD-02 §8 | IDistanceProvider con tres niveles de degradación | Implementado | `src/dispatch/infrastructure/providers/haversine-distance.provider.ts` (ADR-001) |
| DD-02 §9 | IFlagProvider para pesos sin redeployment | Implementado | `src/dispatch/infrastructure/providers/local-flag.provider.ts` (ADR-002) |
| DD-02 §10 | TestContextGuard como stub de auth | Implementado | `src/common/guards/test-context.guard.ts` (ADR-003) |

---

## Audit Findings — v9-deferred (F4/F5/F7/F9/F11) — Resueltos en v0.1.10-mvp

| Finding | TRD Ref | Estado | Resolución | Evidencia |
|---------|---------|--------|-----------|-----------|
| F4 | `.env.example` / DD-02 §4 | Resuelto en v0.1.10-mvp | Claves renombradas (`DISPATCH_W_*`), valor `FLEET_MINIMUM_RESERVE_PCT` corregido a 0.15, nuevas claves (`DISPATCH_SCORING_CONTINUITY_*`, throttler keys). Fallback path: `docs/env-example-new.md`. | `docs/env-example-new.md` |
| F5 | RTF-25 / AuditAction type + SafePoint.activate() | Resuelto en v0.1.12-mvp | `'ACTIVATE'` restaurado a `AuditAction` TS union (Históricamente removida en v0.1.10-mvp como deferral; DB CHECK siempre lo permitió → sin migración). `SafePointsService.activate()` implementado simétrico a `deactivate()`. Rutas dedicadas `PATCH /:id/activate` y `PATCH /:id/deactivate` en controller (ADR-v11-02, ADR-v11-03). | `src/safe-points/infrastructure/safe-point-audit.entity.ts`, `src/safe-points/safe-points.service.ts`, `src/safe-points/safe-points.controller.ts`, `test/integration/safe-points/safe-points.audit.spec.ts` (T-F5-11/12/13) |
| F7 | NFR-19 / analytics observability | Resuelto en v0.1.10-mvp | Counter `analytics_persist_failures_total{event_name}` registrado en `createMetricsRegistry()` e incrementado en catch de `DispatchAnalyticsHandler.persist()`. | `src/common/observability/metrics.registry.ts:147`, `src/analytics/handlers/dispatch.handler.ts:136` |
| F9 | REQ-FIX-V8-01 / idempotency log | Resuelto en v0.1.10-mvp | `PinoLogger` inyectado en `DecisionRepository`; `logger.warn({ requestId, code: '23505' }, ...)` emitido antes de `return;`. | `src/dispatch/infrastructure/persistence/decision.repository.ts:47` |
| F11 | TRD §5 línea 503 (`rider_id` → `user_id`) | Resuelto en v0.1.8-mvp — documentado en v0.1.10-mvp | Migration `17000000010006-RenameAnalyticsColumns` renombró `rider_id`→`user_id`. TRD línea 503 era referencia a página de Google Docs, no a línea de archivo de texto. Confirmado por inspección manual y `src/analytics/handlers/dispatch.handler.ts:125` comment. | `src/migrations/17000000010006-RenameAnalyticsColumns.ts`, `src/analytics/handlers/dispatch.handler.ts:125` |
