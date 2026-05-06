# NexRide MVP — Vertical Slice Backend

## Propósito

NexRide MVP implementa el motor de despacho contextual con sugerencia de puntos seguros de recogida. El sistema evalúa candidatos de vehículos en radio configurable, los filtra por batería, elegibilidad y frescura de telemetría, calcula un score compuesto (proximidad, energía, seguridad, continuidad) y sugiere al rider un punto seguro cercano cuando la mejora relativa de seguridad supera el 15%.

Este repositorio contiene el **vertical slice backend completo**: evaluación de despacho, confirmación, gestión de puntos seguros, módulo de analítica, observabilidad, pruebas y CI con 7 jobs bloqueantes. El alcance está declarado explícitamente en [`SCOPE.md`](./SCOPE.md).

---

## Alcance resumido

| Módulo | Estado | Referencia |
|---|---|---|
| Motor de despacho (`/rides/request`) | Implementado | RTF-16..22 |
| Confirmación de viaje (`/rides/confirm`) | Implementado | RTF-28, DC-01..02 |
| Gestión de puntos seguros (`/safe-points`) | Implementado | RTF-23..25, SP-01..03 |
| Flota read-side (Redis) | Implementado | RTF-14..15 |
| Trip mínimo (`requested → assigned`) | Parcial | RTF-26..28 |
| Analítica de eventos del flujo | Implementado | RTF-31..32 |
| Observabilidad — Rate limiting (NFR-17) | Fuera de Alcance | NFR-17 |
| Observabilidad — Logs estructurados pino (NFR-18) | Implementado | NFR-18 |
| Observabilidad — Métricas Prometheus prom-client (NFR-19) | Implementado | NFR-19 |
| Observabilidad — Alertas configuradas (NFR-20) | Fuera de Alcance | NFR-20 |
| Observabilidad — Tracing OpenTelemetry (NFR-21) | Parcial | NFR-21 |
| CI con 7 jobs bloqueantes | Implementado | CI-01 |

Ver [`SCOPE.md`](./SCOPE.md) para el detalle exhaustivo por ID de requisito (RTF/NFR/CT/CAT).

---

## Arquitectura

El sistema sigue **arquitectura hexagonal con monolito modular**. La regla central: `src/dispatch/**` solo puede acceder a módulos externos mediante interfaces en `src/common/interfaces/**` o eventos en `src/common/events/**`. Ningún módulo externo puede importar desde `src/dispatch/domain/**` o `src/dispatch/application/**`.

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  src/rider/rider.controller.ts                              │
│  POST /rides/request  ·  POST /rides/confirm                │
│         │                                                   │
│         ▼  via DispatchFacade (única entrada pública)       │
│  src/dispatch/                                              │
│    dispatch.facade.ts                                       │
│    application/                                             │
│      evaluate-dispatch.use-case.ts                          │
│      confirm-dispatch.use-case.ts                           │
│    domain/                                                  │
│      services/ (CandidateGenerator, CandidateFilter,        │
│                 ScoringEngine, DecisionMaker,                │
│                 FallbackHandler, DecisionRecorder)           │
│      value-objects/ (GeoPoint, Score, RequestId)            │
│      entities/ (VehicleCandidate, SafePointCandidate)       │
│    infrastructure/                                          │
│      persistence/ (DispatchDecisionEntity, Repository)      │
│      providers/ (HaversineDistanceProvider, LocalFlag)      │
│         │                                                   │
│         │ via common/interfaces/IFleetService               │
│         ▼                                                   │
│  src/fleet/        src/safe-points/   src/trip/             │
│  src/analytics/    (event listeners)                        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
PostgreSQL + PostGIS · Redis
```

Las reglas de arquitectura están automatizadas en `.dependency-cruiser.cjs` y verificadas en cada PR via `npm run arch:check`.

---

## Árbol de directorios

```
nexride/
├── src/
│   ├── main.ts                           # Bootstrap + Prometheus /metrics
│   ├── app.module.ts
│   ├── common/
│   │   ├── config/dispatch.config.ts     # Configuración externalizada
│   │   ├── errors/domain-error.ts        # DomainError base + subclases
│   │   ├── events/event-names.ts, event-payloads.ts
│   │   ├── filters/domain-exception.filter.ts
│   │   ├── guards/test-context.guard.ts, rbac.guard.ts
│   │   ├── interfaces/IFleetService.ts, ISafePointsService.ts, ITripService.ts …
│   │   └── observability/pino.config.ts, metrics.controller.ts, metrics.registry.ts, observability.module.ts, request-id.middleware.ts
│   ├── dispatch/
│   │   ├── dispatch.module.ts
│   │   ├── dispatch.facade.ts            # Única entrada pública del módulo
│   │   ├── application/evaluate-dispatch.use-case.ts, confirm-dispatch.use-case.ts
│   │   ├── domain/entities/, value-objects/, services/
│   │   └── infrastructure/persistence/, providers/
│   ├── fleet/                            # Redis read-side
│   ├── safe-points/                      # CRUD con RBAC + auditoría
│   ├── trip/                             # Trip mínimo (requested → assigned)
│   ├── analytics/                        # Event handlers → analytics_events
│   ├── rider/                            # Controller POST /rides/*
│   └── migrations/                       # 1700000000 … 1700000004
├── test/
│   ├── unit/dispatch/, fleet/, safe-points/
│   ├── integration/rides/, fleet/, safe-points/
│   ├── architecture/dispatch-isolation.spec.ts
│   └── performance/rides-request.k6.js
├── scripts/generate-openapi.ts
├── .dependency-cruiser.cjs
├── .github/workflows/ci.yml              # 7 jobs bloqueantes
├── SCOPE.md
└── docs/traceability-matrix.md
```

---

## Prerequisitos

- **Node.js 20** (LTS). La versión 22+ tiene incompatibilidades con dependency-cruiser — usar Node 20 para `npm run arch:check`.
- **Docker** (para Testcontainers en tests de integración)
- **npm 10+**
- **k6** (para `npm run test:performance` — opcional en local, requerido en CI)

---

## Variables de ambiente

**Crear `.env` manualmente** con el siguiente contenido (`.env.example` está disponible en el repositorio como referencia):

```dotenv
# Base de datos PostgreSQL + PostGIS
DATABASE_URL=postgresql://postgres:password@localhost:5432/nexride

# Redis (fleet geo index + distance cache)
REDIS_URL=redis://localhost:6379

# NestJS
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Test context guard (habilitar en tests locales)
TEST_CONTEXT_GUARD_ENABLED=true

# Dispatch config (opcionales — valores por defecto listos para usar)
DISPATCH_CANDIDATE_RADIUS_KM=5
DISPATCH_SAFE_POINT_RADIUS_M=120
DISPATCH_SUGGESTION_THRESHOLD_PCT=0.15
DISPATCH_ORIGINAL_SAFETY_BASELINE=0.30
DISPATCH_W_PROXIMITY=0.30
DISPATCH_W_ENERGY=0.25
DISPATCH_W_SAFETY=0.25
DISPATCH_W_CONTINUITY=0.20
DISPATCH_PIPELINE_TIMEOUT_MS=1200
DISPATCH_FALLBACK_MIN_BATTERY=20
DISPATCH_MAX_ETA_SECONDS=600

# Fleet
FLEET_MINIMUM_RESERVE_PCT=0.15
FLEET_TELEMETRY_STALENESS_SEC=60

# Distance provider
DISTANCE_CACHE_TTL_SEC=60
DISTANCE_PROVIDER_TIMEOUT_MS=800
DISTANCE_FAULT_INJECTION_RATE=0
```

---

## Comandos

```bash
# Desarrollo
npm run dev                 # NestJS con watch

# Calidad de código
npm run lint                # ESLint (0 errores bloqueante en CI)
npm run lint:fix            # ESLint + autofix
npm run typecheck           # tsc --noEmit (strict)
npm run format:check        # Prettier check

# Tests
npm run test:unit           # Jest unit (128+ tests)
npm run test:unit -- --coverage  # Con reporte de cobertura
npm run test:integration    # Jest integration (Testcontainers — requiere Docker)
npm run test:performance    # k6 smoke test (requiere k6 instalado)

# Arquitectura
npm run arch:check          # dependency-cruiser → 0 violaciones (Node 20)

# Build y OpenAPI
npm run build               # nest build → dist/
npm run openapi:generate    # ts-node scripts/generate-openapi.ts → dist/openapi.json

# Seguridad
npm run audit               # npm audit --audit-level=critical
npm run gitleaks            # gitleaks secrets scan

# Pipeline local completo (mismo orden que CI)
npm run ci:local            # lint + typecheck + arch + cov + integration + audit

# Migraciones
npm run migrate             # Aplica todas las migraciones pendientes
```

---

## Guía de evaluación — dónde encontrar evidencia por ID

| ID TRD | Qué demuestra | Archivo de código | Archivo de prueba |
|---|---|---|---|
| RTF-16 | Candidatura paralela Redis + PostGIS | `src/dispatch/domain/services/candidate-generator.ts` | `test/unit/dispatch/services/candidate-generator.spec.ts` |
| RTF-17 | Filtrado multi-regla (batería, estado, telemetría) | `src/dispatch/domain/services/candidate-filter.ts` | `test/unit/dispatch/services/candidate-filter.spec.ts` |
| RTF-18 | Score compuesto con pesos configurables | `src/dispatch/domain/services/scoring-engine.ts` | `test/unit/dispatch/services/scoring-engine.spec.ts` |
| RTF-19/20 | Decisión ganador + sugerencia ≥15% mejora | `src/dispatch/domain/services/decision-maker.ts` | `test/unit/dispatch/services/decision-maker.spec.ts` |
| RTF-21 | Fallback timeout/sin candidatos → HTTP 422 | `src/dispatch/domain/services/fallback-handler.ts` | `test/unit/dispatch/services/fallback-handler.spec.ts` |
| RTF-22 | Persistencia preliminar con scores_json | `src/dispatch/infrastructure/persistence/decision.repository.ts` | `test/integration/rides/rides.request.spec.ts` |
| RTF-23..25 | SafePoints CRUD + RBAC + auditoría | `src/safe-points/` | `test/integration/safe-points/` |
| RTF-28 | pickup_type + suggested_point_id | `src/trip/infrastructure/trip.entity.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| RTF-31/32 | Analytics eventos dispatch + trip | `src/analytics/handlers/dispatch.handler.ts` | `test/integration/rides/rides.confirm.spec.ts` |
| NFR-01 | Latencia p95<800ms, p99<1200ms | `test/performance/rides-request.k6.js` | CI job `performance-smoke` |
| NFR-09 | Circuit breaker distancia → Haversine | `src/dispatch/infrastructure/providers/haversine-distance.provider.ts` | `test/unit/dispatch/services/haversine-distance-provider.spec.ts` |
| CT-05/06 | Isolation dispatch ↔ fleet/safe-points | `.dependency-cruiser.cjs` | `test/architecture/dispatch-isolation.spec.ts` |

---

## Decisiones técnicas relevantes (5 ADRs)

### ADR-001 — `IDistanceProvider`: Haversine stub con cache Redis y fault injection

El TRD exige NFR-09 (circuito de fallback del proveedor de distancias). Sin credenciales de Google Distance Matrix en sandbox de evaluación, se implementa `HaversineDistanceProvider`: calcula distancia geoespacial + ETA a 25 km/h, cachea en Redis con TTL 60s, y acepta `DISTANCE_FAULT_INJECTION_RATE` para inyección controlada de fallos en tests. El contrato `IDistanceProvider.getEtaSeconds()` es idéntico al de un provider externo real; el swap es **un binding** en `dispatch.module.ts`.

### ADR-002 — `IFlagProvider`: `LocalFlagProvider` sobre `ConfigService`

El DD-02 requiere pesos y thresholds configurables sin redeployment. Se implementa `LocalFlagProvider` que resuelve keys via dot-notation sobre `DispatchConfig`. La interfaz `IFlagProvider` es compatible con cualquier SDK de feature flags (Unleash, LaunchDarkly); el swap no toca el dominio.

### ADR-003 — `TestContextGuard` en lugar de JWT/OTP completo

RTF-01..03 (Auth) están fuera del alcance. Los endpoints de Rider y SafePoints igual requieren identidad autenticada para demostrar RBAC. `TestContextGuard` inyecta `req.user` desde headers `x-test-rider-id`/`x-test-rider-role`, y está **deshabilitado en `NODE_ENV=production`** (lanza `RbacForbiddenError`). El swap a JWT = reemplazar un guard.

### ADR-004 — Umbral k6 CI (superseded en v0.1.1-mvp)

ADR-004 (histórico, v0.1.0-mvp): el gate era p99<1500ms para tolerar overhead variable de runners de GitHub (hasta 300ms). En v0.1.1-mvp el gate CI ahora respeta NFR-01 directamente: p95<800ms y p99<1200ms. La medición real en CI smoke fue p99 ≈ 14ms (85× margen), demostrando que p99<1200ms es seguro y coherente con el objetivo de producción. ADR retenido para auditoría histórica de la decisión.

### ADR-005 — `EventEmitter2` in-process vs Kafka

DD-01 especifica un bus de eventos in-process para el monolito MVP. Kafka agrega infra (brokers, particiones, schemas) sin valor evaluable en este slice. `@nestjs/event-emitter` con canales nombrados `dispatch.*`/`trip.*` permite extracción directa a Kafka: los nombres de canal ya son estables y los handlers en `analytics/` serían simplemente consumidores Kafka.

---

## Limitaciones conocidas

1. **npm audit high**: 15 vulnerabilidades `high` pre-existentes en NestJS 10 + Express 4. Sin fix disponible sin migrar a NestJS 11 (breaking change). Gate CI: `--audit-level=critical` (0 críticas).

2. **dependency-cruiser en Node >=22**: `npx depcruise` puede fallar con Node 25 (experimental VM modules). CI usa Node 20. El test de arquitectura detecta la versión y salta con advertencia en Node >=22.

3. **TestContextGuard deshabilitado por defecto**: Requiere `TEST_CONTEXT_GUARD_ENABLED=true` en `.env`. En tests de integración se setea vía `process.env` antes del bootstrap.

4. **Performance test requiere Docker**: `npm run test:integration` levanta Testcontainers. Sin Docker activo, los tests de integración fallarán con error de conexión.

5. **`DispatchDecisionEntity` usa lat/lng DOUBLE PRECISION**: El diseño original propone geography(Point,4326) para `dispatch_decisions`. Para mantener la entidad unit-testable sin PostGIS, se almacenan coords como floats. El tipo geography está en `safe_points` (donde se necesita ST_DWithin).
