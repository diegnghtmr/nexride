# Traceability Matrix — NexRide MVP Vertical Slice

> Ordenada por documento fuente. Ver `SCOPE.md` para la misma información ordenada por ID de requisito.

---

## TRD §3 — Requisitos Técnicos Funcionales (RTF)

| TRD Ref | ID | Estado | Evidencia código | Evidencia prueba |
|---|---|---|---|---|
| TRD §3.1 | RTF-01 | Fuera de Alcance — Auth OTP | `src/common/guards/test-context.guard.ts` (ADR-003) | `test/unit/common/guards/test-context.guard.spec.ts` |
| TRD §3.1 | RTF-02 | Fuera de Alcance — Sesiones | — | — |
| TRD §3.1 | RTF-03 | Fuera de Alcance — Registro | — | — |
| TRD §3.2 | RTF-04..12 | Fuera de Alcance — Mobile/UX | — | — |
| TRD §3.3 | RTF-13 | Parcial — fleet read-side con fixtures | `src/fleet/infrastructure/fleet.seed.ts` | `test/integration/fleet/fleet.read.spec.ts` |
| TRD §3.3 | RTF-14 | Implementado | `src/fleet/fleet.service.ts` | `test/unit/fleet/fleet.service.spec.ts` |
| TRD §3.3 | RTF-15 | Implementado | `src/fleet/infrastructure/redis-fleet.adapter.ts` | `test/integration/fleet/fleet.read.spec.ts` |
| TRD §3.4 | RTF-16 | Implementado | `src/dispatch/domain/services/candidate-generator.ts` | `test/unit/dispatch/services/candidate-generator.spec.ts` |
| TRD §3.4 | RTF-17 | Implementado | `src/dispatch/domain/services/candidate-filter.ts` | `test/unit/dispatch/services/candidate-filter.spec.ts` |
| TRD §3.4 | RTF-18 | Implementado | `src/dispatch/domain/services/scoring-engine.ts` | `test/unit/dispatch/services/scoring-engine.spec.ts` |
| TRD §3.4 | RTF-19 | Implementado | `src/dispatch/domain/services/decision-maker.ts` | `test/unit/dispatch/services/decision-maker.spec.ts` |
| TRD §3.4 | RTF-20 | Implementado | `src/dispatch/domain/services/decision-maker.ts` | `test/unit/dispatch/services/decision-maker.spec.ts` |
| TRD §3.4 | RTF-21 | Implementado | `src/dispatch/domain/services/fallback-handler.ts` | `test/unit/dispatch/services/fallback-handler.spec.ts` |
| TRD §3.4 | RTF-22 | Implementado | `src/dispatch/domain/services/decision-recorder.ts` | `test/unit/dispatch/services/decision-recorder.spec.ts`, `test/integration/rides/rides.request.spec.ts` |
| TRD §3.5 | RTF-23 | Implementado | `src/safe-points/safe-points.service.ts` | `test/integration/safe-points/safe-points.crud.spec.ts` |
| TRD §3.5 | RTF-24 | Implementado | `src/safe-points/safe-points.controller.ts` | `test/integration/safe-points/safe-points.rbac.spec.ts` |
| TRD §3.5 | RTF-25 | Implementado | `src/safe-points/infrastructure/safe-point-audit.entity.ts` | `test/integration/safe-points/safe-points.audit.spec.ts` |
| TRD §3.6 | RTF-26 | Parcial | `src/trip/trip.service.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §3.6 | RTF-27 | Parcial | `src/trip/trip.service.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §3.6 | RTF-28 | Implementado | `src/trip/infrastructure/trip.entity.ts`, `src/dispatch/application/confirm-dispatch.use-case.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §3.7 | RTF-29..30 | Fuera de Alcance — Notificaciones/Loyalty | — | — |
| TRD §3.8 | RTF-31 | Implementado | `src/analytics/handlers/dispatch.handler.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §3.8 | RTF-32 | Implementado | `src/analytics/handlers/dispatch.handler.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §3.9 | RTF-33..35 | Fuera de Alcance — Ops panel | — | — |

---

## TRD §4 — Requisitos No Funcionales (NFR)

| TRD Ref | ID | Estado | Evidencia código | Evidencia prueba |
|---|---|---|---|---|
| TRD §4.1 | NFR-01 | Implementado | `test/performance/rides-request.k6.js` | CI job `performance-smoke` |
| TRD §4.2..8 | NFR-02..08 | Fuera de Alcance — Infra producción | — | — |
| TRD §4.9 | NFR-09 | Implementado | `src/dispatch/infrastructure/providers/haversine-distance.provider.ts` | `test/unit/dispatch/services/haversine-distance-provider.spec.ts` |
| TRD §4.10 | NFR-10 | Implementado | `src/dispatch/application/confirm-dispatch.use-case.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| TRD §4.11..16 | NFR-11..16 | Fuera de Alcance — Infra producción | — | — |
| TRD §4.17 | NFR-17 | Implementado | `src/common/observability/logger.module.ts` | `test/integration/rides/rides.request.spec.ts` |
| TRD §4.18 | NFR-18 | Implementado | `src/common/observability/metrics.module.ts` | `GET /metrics` |
| TRD §4.19 | NFR-19 | Implementado | `src/common/observability/tracing.module.ts` | Bootstrap en `src/main.ts` |
| TRD §4.20 | NFR-20 | Implementado | `src/common/observability/metrics.module.ts` | Metrics definitions |
| TRD §4.21 | NFR-21 | Implementado | `src/main.ts` (`GET /metrics`) | Endpoint Prometheus |

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

| DD-01 Ref | Decisión | Estado | Evidencia |
|---|---|---|---|
| DD-01 §1 | Módulos NestJS con fronteras explícitas | Implementado | `.dependency-cruiser.cjs` + `test/architecture/dispatch-isolation.spec.ts` |
| DD-01 §2 | Dispatch consume fleet/safe-points solo via interfaces | Implementado | `src/common/interfaces/IFleetService.ts`, `ISafePointsService.ts` |
| DD-01 §3 | In-process event bus para analytics | Implementado | `src/common/events/`, `src/analytics/handlers/dispatch.handler.ts` |
| DD-01 §4 | Hexagonal — dominio framework-agnostic | Implementado | `src/dispatch/domain/**` (cero imports @nestjs) |
| DD-01 §5 | Migraciones explícitas TypeORM | Implementado | `src/migrations/1700000000-1700000004.ts` |

---

## DD-02 — Dispatch Design Document

| DD-02 Ref | Decisión | Estado | Evidencia |
|---|---|---|---|
| DD-02 §3 | Pipeline EvaluateDispatch: candidatura → filtrado → scoring → decisión → persistencia | Implementado | `src/dispatch/application/evaluate-dispatch.use-case.ts` |
| DD-02 §4 | Config externalizada (pesos, radios, timeouts) | Implementado | `src/common/config/dispatch.config.ts` |
| DD-02 §5 | Fórmulas de score: proximity, energy, safety, continuity | Implementado | `src/dispatch/domain/services/scoring-engine.ts` |
| DD-02 §6 | Suggeston gate: mejora relativa ≥15% AND caminata <120m | Implementado | `src/dispatch/domain/services/decision-maker.ts` |
| DD-02 §7 | ConfirmDispatch: transacción ACID + eventos | Implementado | `src/dispatch/application/confirm-dispatch.use-case.ts` |
| DD-02 §8 | IDistanceProvider con tres niveles de degradación | Implementado | `src/dispatch/infrastructure/providers/haversine-distance.provider.ts` (ADR-001) |
| DD-02 §9 | IFlagProvider para pesos sin redeployment | Implementado | `src/dispatch/infrastructure/providers/local-flag.provider.ts` (ADR-002) |
| DD-02 §10 | TestContextGuard como stub de auth | Implementado | `src/common/guards/test-context.guard.ts` (ADR-003) |
