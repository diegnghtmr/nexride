# SCOPE.md — NexRide MVP Vertical Slice

> Estado: SKELETON — completar evidencias en Phase 5 (`sdd-apply Phase 5`).

## 1. Propósito y alcance declarado

Este documento es la matriz de trazabilidad oficial del vertical slice NexRide MVP. Cada requisito funcional (RTF), no funcional (NFR) y criterio de aceptación técnica (CT/CAT) aparece en la tabla con su estado actual, ruta de código y ruta de test.

## 2. Matriz de requisitos

| ID | Tipo | Estado | Evidencia código | Evidencia prueba | Justificación |
|---|---|---|---|---|---|
| RTF-01 | RTF | Out of Scope | — | — | Autenticación OTP fuera del alcance del slice; sustituida por TestContextGuard (ADR-003) |
| RTF-02 | RTF | Out of Scope | — | — | Gestión de sesiones fuera del alcance del slice |
| RTF-03 | RTF | Out of Scope | — | — | Registro de usuarios fuera del alcance del slice |
| RTF-04 | RTF | Out of Scope | — | — | Perfil de usuario fuera del alcance del slice |
| RTF-05 | RTF | Out of Scope | — | — | Actualización de datos de perfil fuera del alcance del slice |
| RTF-06 | RTF | Out of Scope | — | — | Historial de viajes completo fuera del alcance del slice |
| RTF-07 | RTF | Out of Scope | — | — | Calificaciones fuera del alcance del slice |
| RTF-08 | RTF | Out of Scope | — | — | Pagos fuera del alcance del slice |
| RTF-09 | RTF | Out of Scope | — | — | Notificaciones push fuera del alcance del slice |
| RTF-10 | RTF | Out of Scope | — | — | Chat fuera del alcance del slice |
| RTF-11 | RTF | Out of Scope | — | — | Mapa en tiempo real fuera del alcance del slice |
| RTF-12 | RTF | Out of Scope | — | — | Cancelación de viaje fuera del alcance del slice |
| RTF-13 | RTF | Partial | src/fleet/ | test/unit/fleet/ | Solo read-side con fixtures; escritura de telemetría fuera del alcance |
| RTF-14 | RTF | TBD-IMPL | src/fleet/fleet.service.ts | test/unit/fleet/fleet-service.spec.ts | — |
| RTF-15 | RTF | TBD-IMPL | src/fleet/infrastructure/redis-fleet.repository.ts | test/integration/fleet.spec.ts | — |
| RTF-16 | RTF | TBD-IMPL | src/dispatch/domain/services/candidate-generator.ts | test/unit/dispatch/candidate-generator.spec.ts | — |
| RTF-17 | RTF | TBD-IMPL | src/dispatch/domain/services/candidate-filter.ts | test/unit/dispatch/candidate-filter.spec.ts | — |
| RTF-18 | RTF | TBD-IMPL | src/dispatch/domain/services/scoring-engine.ts | test/unit/dispatch/scoring-engine.spec.ts | — |
| RTF-19 | RTF | TBD-IMPL | src/dispatch/domain/services/decision-maker.ts | test/unit/dispatch/decision-maker.spec.ts | — |
| RTF-20 | RTF | TBD-IMPL | src/dispatch/domain/services/decision-maker.ts | test/unit/dispatch/decision-maker.spec.ts | — |
| RTF-21 | RTF | TBD-IMPL | src/dispatch/domain/services/fallback-handler.ts | test/unit/dispatch/fallback-handler.spec.ts | — |
| RTF-22 | RTF | TBD-IMPL | src/dispatch/domain/services/decision-recorder.ts | test/unit/dispatch/decision-recorder.spec.ts | — |
| RTF-23 | RTF | TBD-IMPL | src/safe-points/safe-points.service.ts | test/integration/safe-points.crud.spec.ts | — |
| RTF-24 | RTF | TBD-IMPL | src/safe-points/safe-points.controller.ts | test/integration/safe-points.crud.spec.ts | — |
| RTF-25 | RTF | TBD-IMPL | src/safe-points/infrastructure/safe-point-audit.repository.ts | test/unit/safe-points/safe-points-service.spec.ts | — |
| RTF-26 | RTF | Partial | src/trip/trip.service.ts | test/integration/rides.confirm.spec.ts | Solo transición requested→assigned; estados posteriores fuera del alcance |
| RTF-27 | RTF | Partial | src/trip/trip.service.ts | test/integration/rides.confirm.spec.ts | Solo transición requested→assigned; estados posteriores fuera del alcance |
| RTF-28 | RTF | TBD-IMPL | src/dispatch/application/confirm-dispatch.use-case.ts | test/integration/rides.confirm.spec.ts | — |
| RTF-29 | RTF | Out of Scope | — | — | Sistema de recompensas fuera del alcance del slice |
| RTF-30 | RTF | Out of Scope | — | — | Programa de fidelidad fuera del alcance del slice |
| RTF-31 | RTF | TBD-IMPL | src/analytics/analytics.service.ts | test/integration/rides.request.spec.ts | — |
| RTF-32 | RTF | TBD-IMPL | src/analytics/handlers/ | test/integration/rides.confirm.spec.ts | — |
| RTF-33 | RTF | Out of Scope | — | — | Reportes de administrador fuera del alcance del slice |
| RTF-34 | RTF | Out of Scope | — | — | Dashboard de métricas fuera del alcance del slice |
| RTF-35 | RTF | Out of Scope | — | — | Exportación de datos fuera del alcance del slice |
| NFR-01 | NFR | TBD-IMPL | test/performance/rides-request.k6.js | k6 p95<800ms, p99<1500ms (CI-lenient; producción 1200ms — ver Variances) | — |
| NFR-02 | NFR | Out of Scope | — | — | SLA de uptime fuera del alcance del slice |
| NFR-03 | NFR | Out of Scope | — | — | Auto-scaling fuera del alcance del slice |
| NFR-04 | NFR | Out of Scope | — | — | Disaster recovery fuera del alcance del slice |
| NFR-05 | NFR | Out of Scope | — | — | Multi-region fuera del alcance del slice |
| NFR-06 | NFR | Out of Scope | — | — | CDN fuera del alcance del slice |
| NFR-07 | NFR | Out of Scope | — | — | Rate limiting avanzado fuera del alcance del slice |
| NFR-08 | NFR | Out of Scope | — | — | WAF fuera del alcance del slice |
| NFR-09 | NFR | TBD-IMPL | src/dispatch/infrastructure/providers/haversine-distance.provider.ts | test/unit/dispatch/haversine-distance-provider.spec.ts | Stub con fault injection (ADR-001) |
| NFR-10 | NFR | TBD-IMPL | src/dispatch/application/confirm-dispatch.use-case.ts | test/integration/rides.confirm.spec.ts | Transacción ACID TypeORM |
| NFR-11 | NFR | Out of Scope | — | — | Encriptación en reposo fuera del alcance del slice |
| NFR-12 | NFR | Out of Scope | — | — | Rotación de credenciales fuera del alcance del slice |
| NFR-13 | NFR | Out of Scope | — | — | Auditoría de acceso completa fuera del alcance del slice |
| NFR-14 | NFR | Out of Scope | — | — | Compliance GDPR completo fuera del alcance del slice |
| NFR-15 | NFR | Out of Scope | — | — | Penetration testing fuera del alcance del slice |
| NFR-16 | NFR | Out of Scope | — | — | Backup automático fuera del alcance del slice |
| NFR-17 | NFR | TBD-IMPL | src/common/observability/logger.module.ts | test/integration/rides.request.spec.ts | nestjs-pino structured JSON |
| NFR-18 | NFR | TBD-IMPL | src/common/observability/metrics.module.ts | test/integration/rides.request.spec.ts | prom-client histograms y counters |
| NFR-19 | NFR | TBD-IMPL | src/common/observability/tracing.module.ts | — | OpenTelemetry SDK bootstrap |
| NFR-20 | NFR | TBD-IMPL | src/common/observability/metrics.module.ts | — | Alert definitions via prom-client |
| NFR-21 | NFR | TBD-IMPL | src/main.ts (GET /metrics) | test/integration/rides.request.spec.ts | Endpoint Prometheus scrape |
| CT-01 | CT | TBD-IMPL | .github/workflows/ci.yml | CI verde | job lint-typecheck |
| CT-02 | CT | TBD-IMPL | .github/workflows/ci.yml | CI verde | job unit-tests |
| CT-03 | CT | TBD-IMPL | .github/workflows/ci.yml | CI verde | job integration-tests |
| CT-04 | CT | TBD-IMPL | .github/workflows/ci.yml | CI verde | job performance-smoke |
| CT-05 | CT | TBD-IMPL | .dependency-cruiser.cjs | test/architecture/dispatch-isolation.spec.ts | AR-01: dispatch isolation |
| CT-06 | CT | TBD-IMPL | .dependency-cruiser.cjs | test/architecture/dispatch-isolation.spec.ts | AR-02: no dispatch internals exposed |
| CT-07 | CT | TBD-IMPL | .github/workflows/ci.yml | CI verde | job security-static |
| CT-08 | CT | TBD-IMPL | .github/workflows/ci.yml | CI verde | job build-openapi |
| CT-09 | CT | TBD-IMPL | .github/workflows/ci.yml | CI verde | job architecture-rules |
| CT-10 | CT | TBD-IMPL | SCOPE.md (este archivo) | CI: SCOPE.md present | ST-01 |
| CAT-01 | CAT | TBD-IMPL | — | — | — |
| CAT-02 | CAT | TBD-IMPL | — | — | — |
| CAT-03 | CAT | TBD-IMPL | — | — | — |
| CAT-04 | CAT | TBD-IMPL | — | — | — |
| CAT-05 | CAT | TBD-IMPL | — | — | — |

## 3. Adaptaciones

| ADR | Descripción | Justificación |
|---|---|---|
| ADR-001 | `IDistanceProvider` stub (Haversine + Redis cache + fault injection) | NFR-09 testable sin credenciales; swap a live impl es solo un binding |
| ADR-002 | `IFlagProvider` local (`LocalFlagProvider` via `ConfigService`) | Sin infra Unleash para MVP; interfaz idéntica, drop-in reemplazo |
| ADR-003 | `TestContextGuard` en lugar de JWT/OTP completo | RTF-01..03 fuera de alcance; guard activo solo cuando `NODE_ENV !== 'production'` |
| ADR-004 | k6 CI p99 < 1500ms (leniente) vs producción 1200ms | Runners de GitHub más ruidosos; gate real de calidad via p95 < 800ms |
| ADR-005 | `EventEmitter2` in-process vs Kafka | Monolito MVP; extracción a Kafka post-MVP es solo adapter |

## 4. Variances

| Métrica | Valor CI | Valor Producción | Referencia |
|---|---|---|---|
| k6 p99 latencia `/rides/request` | < 1500ms | < 1200ms | ADR-004 |
| k6 p95 latencia `/rides/request` | < 800ms | < 800ms | NFR-01 (mismo) |

## 5. Reproducibilidad

```bash
npm run ci:local
```

Ejecuta: lint → typecheck → arch:check → test:cov → test:integration → audit.
