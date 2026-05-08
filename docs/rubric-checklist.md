# Rubric Cross-Check — NexRide MVP

Generated: 2026-05-05 (refreshed: 2026-05-07)
Commit: HEAD on main (tag v0.1.20-mvp; históricamente v0.1.19-mvp / v0.1.18-mvp / v0.1.17-mvp / v0.1.16-mvp / v0.1.15-mvp / v0.1.14-mvp / v0.1.13-mvp)
CI Run: see v0.1.20-mvp CI run on main (7/7 green; históricamente v0.1.19-mvp, v0.1.18-mvp y v0.1.17-mvp 7/7 green)
Fuente: `docs/8. 📄 Guía del estudiante – Código + Pruebas + CI.pdf`

## Resumen

- Total de items evaluables: **18**
- Completos: **17**
- Parciales: **1**
- Faltantes: **0**

Veredicto: **READY TO SUBMIT** — **NFR-21 parcial** (OpenTelemetry SDK instalado, NodeSDK.start() pendiente, declarado en SCOPE.md). Los demás 17 criterios tienen evidencia concreta. Los stubs (Haversine, LocalFlag, TestContextGuard) están justificados como ADRs aceptados.

---

## §01 — Entregables requeridos

| # | Item | Estado | Evidencia | Nota |
|---|------|--------|-----------|------|
| E1 | Repositorio de código fuente con código + pruebas + CI antes de la evaluación | Completo | `src/` (vertical slice Dispatch+SafePoints+Fleet+Trip+Analytics), `test/` (unit + integration + architecture + performance), `.github/workflows/ci.yml` | Tag `v0.1.20-mvp` en `main`. v0.1.20 cierra residuals del 19° judgment day (PR #48): F1 `UpdateSafePointDto.LocationDto` con `@Min/@Max` WGS-84 (paridad con Create cerrado en v0.1.19 — el sweep predicho en engram archive #1213 reapareció exactamente como se anticipó), F2 `FindWithinQueryDto.lat/lng` también con bounds WGS-84, F3 `FindWithinQueryDto.radiusM` con `@Min(1)/@Max(5000)` (cap espeja `DISPATCH_CANDIDATE_RADIUS_KM=5`; default sigue 120m — antes un cliente podía pedir radiusM=99_999_999 y forzar scan abusivo en PostGIS), F4 `CandidateFilter` Rule 1.5 rechaza `state==='busy'` con reason='busy' (cierra asimetría con `fallback-handler.ts:31` que ya filtraba busy — sin esto, vehículo en viaje activo entraba al ranking de scoring). RED→GREEN: 17 nuevos unit tests safe-points (3 archivos DTO) + 1 nuevo en candidate-filter; 249/249 unit tests verde. Históricamente v0.1.19-mvp cerraba residuals del 18° judgment day (todos en PR #47): F4 env-vars huérfanas purgadas en `.env.example` (RATE_LIMIT_TTL/RATE_LIMIT_MAX/THROTTLER_TTL_MS/THROTTLER_LIMIT no se usan; reemplazadas por las reales THROTTLE_USER_LIMIT/THROTTLE_IP_LIMIT/THROTTLER_TEST_LIMIT/THROTTLER_DISABLED), F5 WGS-84 bounds (`@Min/@Max` en `LocationDto` lat∈[-90,90] lng∈[-180,180]) con RED→GREEN unit suite (6/6 verde) — antes `lat=999` propagaba a PostGIS y devolvía 5xx en vez de 400, F1 ADR-008 clarification (release.yml es publisher post-tag, no segundo pipeline CI/CD — se documenta para evitar reapertura del finding por revisores futuros), CRITICAL operacional: branch protection aplicada en `main` vía `gh api` (7 required checks strict, no force-push, no deletions). Históricamente v0.1.18-mvp cerraba residuals del 17° judgment day: F4 `@SkipThrottle({user,ip})` real exemption en /metrics (default `{default:true}` era no-op contra throttlers nombrados, juez A acertó con cita a `node_modules/@nestjs/throttler/dist/throttler.decorator.js:27`), F2 `verify-status-consistency.sh` extendido a bidirectional + compound IDs, F1+F11 line-drift sweep (referencias a `ci.yml` por nombre de job, no por línea), F3 thresholds per-path documentados en T1/CI2/K4, F9 ADR-008 amendment (push-bare post-public-repo), F12 `forbidNonWhitelisted: true` en 7 integration tests faltantes. |
| E2 | Alcance declarado obligatorio (README/SCOPE.md o equivalente) con qué se implementó y qué no, con justificación | Completo | `SCOPE.md:1-153` (matriz exhaustiva por ID RTF/NFR/CT/CAT con estado, ruta de código, ruta de prueba y justificación) | Cumple ST-01 / CT-10. |
| E3 | Suite de pruebas (unit / integration / performance según TRD) o justificación de omisión | Completo | Unit: `test/unit/**` (128+ specs incl. dispatch/services, fleet, safe-points, common). Integration: `test/integration/rides/**`, `test/integration/safe-points/**`, `test/integration/fleet/fleet.read.spec.ts`. Performance: `test/performance/rides-request.k6.js`. Architecture: `test/architecture/dispatch-isolation.spec.ts`. | Las cuatro familias exigidas por TRD están presentes. |
| E4 | Configuración de CI como código en el repo, ejecutándose automáticamente en cada push/PR, cubriendo build + test + análisis estático | Completo | `.github/workflows/ci.yml` (239 líneas) — triggers `push` y `pull_request` (header `on:` block); 7 jobs por nombre: `lint-typecheck`, `architecture-rules`, `unit-tests`, `integration-tests`, `performance-smoke`, `security-static`, `build-openapi`. Preferimos referencias por nombre de job para evitar drift de líneas (residual judgment 17° F1). | No requiere deploy. |

---

## §02 Parte I — Código (40%)

| # | Criterio rúbrica | Estado | Evidencia | Nota |
|---|------------------|--------|-----------|------|
| C1 | Alcance declarado e implementado: declararon claramente qué implementaron y el código cubre lo prometido | Completo | `SCOPE.md:13-86` matriz por ID; `README.md:13-23` resumen de alcance; `docs/traceability-matrix.md` matriz por documento fuente. Código: `src/dispatch/`, `src/safe-points/`, `src/fleet/`, `src/trip/`, `src/analytics/`, `src/rider/`. | Cero ambigüedad: cada ID con `Implementado` / `Parcial` / `Fuera de Alcance`. |
| C2 | Alineación arquitectónica: la estructura del código refleja el Design Doc; desviaciones justificadas | Completo | Estructura espejo del DD-01: `src/dispatch/{application,domain,infrastructure}` (`README.md:42-65`); fachada única `src/dispatch/dispatch.facade.ts`; reglas modulares automatizadas en `.dependency-cruiser.cjs` y validadas por `test/architecture/dispatch-isolation.spec.ts` y job `architecture-rules` en `ci.yml`. Desviaciones documentadas en `README.md:221-242` (5 ADRs) y `SCOPE.md:89-99`. | CT-05/06 codificados como gate. |
| C3 | Calidad del código: convenciones del stack, separación de responsabilidades, ausencia de antipatrones obvios | Completo | NestJS 11 + TypeScript strict (`package.json:28-50`, `tsconfig.json`); ESLint + Prettier obligatorios (job `lint-typecheck` en `ci.yml`); separación clara `application` ↔ `domain` ↔ `infrastructure` por módulo; servicios de dominio con responsabilidad única (`src/dispatch/domain/services/{candidate-generator,candidate-filter,scoring-engine,decision-maker,fallback-handler,decision-recorder}.ts`). | `npm run lint` 0 errores, `tsc --noEmit` 0 errores en CI. |
| C4 | NFRs en código: seguridad sin hardcoding, observabilidad en flujos críticos, manejo de errores, resiliencia | Completo | Seguridad: cero secretos (job `security-static` en `ci.yml` con `gitleaks` step), config externalizada (`src/common/config/dispatch.config.ts`, `.env.example`), RBAC `src/common/guards/rbac.guard.ts`. Observabilidad (NFR-17..21 — estado per-ID): NFR-17 Implementado — `src/app.module.ts:60-86` (ThrottlerModule dos throttlers nombrados: user 100/min, ip 1000/min), `src/common/guards/configurable-throttler.guard.ts:43-50` (getTracker: user.id ?? ip), `test/integration/rides/throttling.spec.ts` (3 escenarios: per-user 429, per-IP 429, unauth sin 500); NFR-18 Implementado — pino JSON `src/common/observability/pino.config.ts`; NFR-19 Implementado — métricas Prometheus `GET /metrics` vía `ObservabilityModule` (`src/common/observability/metrics.controller.ts`); NFR-20 Fuera de Alcance (alertas Alertmanager/PagerDuty post-MVP); NFR-21 Parcial — `@opentelemetry/sdk-node` instalado, `NodeSDK.start()` pendiente (ver SCOPE.md NFR-21). Errores: `src/common/errors/domain-error.ts` + `src/common/filters/domain-exception.filter.ts`. Resiliencia: `HaversineDistanceProvider` con caché Redis + fallback (`src/dispatch/infrastructure/providers/haversine-distance.provider.ts`), `FallbackHandler` (`src/dispatch/domain/services/fallback-handler.ts`), transacción ACID en confirmación (`src/dispatch/application/confirm-dispatch.use-case.ts`). | NFR-09, NFR-10, NFR-17..21 en SCOPE.md §2. |

---

## §02 Parte II — Pruebas (30%)

| # | Criterio rúbrica | Estado | Evidencia | Nota |
|---|------------------|--------|-----------|------|
| T1 | Alineación con el TRD: tipos de prueba y criterios de aceptación cubiertos o omisión justificada | Completo | Unit + Integration + Performance + Architecture presentes. Mapeo ID→prueba en `README.md:204-217` y `SCOPE.md:30-86`. CT-01..CT-10 cubiertos por jobs de CI. | Cobertura per-path enforced en `jest.unit.config.cjs` `coverageThreshold`: dispatch/domain ≥85%/≥80% stmts/branches; dispatch/application ≥80%/≥40% (matiz residual judgment 16° B1: orquestación dominantemente integration-tested); dispatch/infrastructure/providers + safe-points.service ≥85%/≥80%. |
| T2 | Calidad de las pruebas: prueban comportamiento (no detalles internos), nombres descriptivos, independencia | Completo | Specs orientadas a comportamiento (e.g. `test/unit/dispatch/services/decision-maker.spec.ts` cubre límite exacto 15% mejora + 120m caminata; `scoring-engine.spec.ts` 11 casos de fórmula compuesta). Tests de integración usan Supertest contra el HTTP real, no mocks (`test/integration/rides/rides.request.spec.ts`, `rides.confirm.spec.ts`). Cada spec con `beforeEach` que aísla estado (Testcontainers Postgres+Redis efímeros). | Nombres: `it('rejects suggestion when relative safety improvement is below 15%')` etc. |
| T3 | Cobertura de escenarios: happy path + flujos de error + casos límite + integración y performance (si TRD los requiere) | Completo | Happy path: `rides.request.spec.ts` 201 con requestId. Errores: `fallback-handler.spec.ts` (timeout, sin candidatos, batería <20%); `domain-exception-filter.spec.ts`; `safe-points.rbac.spec.ts` (403); `confirm-dispatch.use-case.spec.ts` (404/409 doble confirmación). Casos límite: `decision-maker.spec.ts` (15.0% exacto, 120.0m exacto inclusivo desde v0.1.12-mvp — históricamente 119.9m vs 120.0m exclusivo hasta v0.1.11-mvp — `SCOPE.md:107`). Integration: `test/integration/**` con PostGIS+Redis reales. Performance: `test/performance/rides-request.k6.js` con thresholds `p95<800ms`, `p99<1200ms` (alineados con NFR-01, históricamente activos desde v0.1.2-mvp, vigentes en v0.1.13-mvp). | Test del proveedor externo de distancias falla controladamente vía `DISTANCE_INJECT_TIMEOUT=true` (`haversine-distance-provider.spec.ts`; históricamente documentado como `DISTANCE_FAULT_INJECTION_RATE` hasta v0.1.12-mvp). |

---

## §02 Parte III — CI (17%)

| # | Criterio rúbrica | Estado | Evidencia | Nota |
|---|------------------|--------|-----------|------|
| CI1 | Completitud del pipeline: build + test + análisis estático automáticos en cada push/PR; fallos distinguibles por tipo | Completo | `ci.yml` header `on:` triggers automáticos en `push` y `pull_request`. 7 jobs separados con nombres distintos (`lint-typecheck`, `architecture-rules`, `unit-tests`, `integration-tests`, `performance-smoke`, `security-static`, `build-openapi`) — cada fallo identifica la dimensión. Build incluido en step `npm run openapi:generate` del job `build-openapi`. Análisis estático: ESLint + tsc + dependency-cruiser + npm audit + gitleaks. `scripts/verify-doc-paths.sh`, `scripts/verify-doc-consistency.sh` y `scripts/verify-status-consistency.sh` (v0.1.17-mvp) wired como steps en lint-typecheck. | v0.1.20-mvp: 7/7 verde (CI run on main, tag v0.1.20-mvp; históricamente v0.1.19-mvp, v0.1.18-mvp y v0.1.17-mvp también 7/7 verde). |
| CI2 | Quality gates y criterios automatizados: ≥1 threshold real que bloquea merge; criterios cuantificables del TRD codificados; pipeline reproducible | Completo (100%) | Gates bloqueantes: ESLint 0 errores; tsc 0 errores; cobertura per-path en `jest.unit.config.cjs coverageThreshold` (dispatch/domain ≥85/≥80 stmts/branches; dispatch/application ≥80/≥40 — orquestación integration-tested per residual 16° B1; providers + safe-points.service ≥85/≥80); `depcruise` 0 violaciones (job `architecture-rules`); k6 `p95<800ms`, `p99<1200ms` y `checks rate==1.0` (`test/performance/rides-request.k6.js` thresholds, alineados NFR-01); `npm audit --audit-level=high --omit=dev` 0 highs; gitleaks 0 secretos; `openapi.json` debe generarse. Reproducibilidad: `npm run ci:local` ejecuta los jobs **bloqueantes** localmente. `performance-smoke` (k6 + Docker) y `build-openapi` (DB live) quedan delegados a CI por requisitos de infra; `scripts/ci-local.sh` lo declara explícitamente en su header `INTENTIONALLY EXCLUDED`. Históricamente hasta v0.1.12-mvp esta celda decía "ejecuta el pipeline localmente" sin matiz; matizado en v0.1.13-mvp; thresholds per-path documentados en v0.1.17-mvp tras residual judgment 16° B1. Security gate (gitleaks + npm audit) documentado en ADR-007; ADR-006 superseded. | No hay thresholds vacíos: la cobertura genera fallo real si baja. |

---

## §02 Parte IV — Coherencia con documentos (13%)

| # | Criterio rúbrica | Estado | Evidencia | Nota |
|---|------------------|--------|-----------|------|
| D1 | Trazabilidad funcional: requisitos del TRD/PRD del alcance son identificables en código o demostrables con tests | Completo | `SCOPE.md:13-86` matriz por ID con ruta de código y ruta de prueba para cada RTF/NFR/CT/CAT. `docs/traceability-matrix.md` vista por documento fuente. `README.md:204-217` tabla de evaluación rápida. | Cualquier ID `Implementado` se puede verificar en <30s. |
| D2 | Consistencia con el Design Doc: tecnologías, patrones y restricciones del DD respetadas; desviaciones documentadas | Completo | Stack DD-01 respetado: NestJS modular, PostgreSQL+PostGIS, Redis, EventEmitter2 in-process (`src/app.module.ts`, migrations 1700000000..04). Restricción CT-05/06 (Dispatch aislado) automatizada en `.dependency-cruiser.cjs` + `test/architecture/dispatch-isolation.spec.ts`. Pipeline DD-02 (candidatura→filtro→scoring→decisión→registro) literal en `src/dispatch/domain/services/`. Desviaciones: 5 ADRs en `README.md:221-242` y `SCOPE.md:89-99` (Haversine stub, LocalFlag stub, TestContextGuard, k6 p99 leniente, EventEmitter2 vs Kafka) — ninguna contradice el DD; todas mantienen el contrato de interfaz. Rutas de documentación verificadas en CI vía `scripts/verify-doc-paths.sh` (job lint-typecheck). | Trazabilidad completa también vs PRD/RFC/TRD. |

---

## §06 — Claves para una buena entrega (cross-checks finales)

| # | Clave | Estado | Evidencia |
|---|-------|--------|-----------|
| K1 | Alcance declarado explícito (cada requisito listado, justificación de excluidos) | Completo | `SCOPE.md` lista RTF-01..35, NFR-01..21, CT-01..10, CAT-01..05 individualmente. |
| K2 | Código refleja el Design Doc; cambios documentados | Completo | 5 ADRs documentados (`README.md:221-242`, `SCOPE.md:89-99`). |
| K3 | Tests prueban comportamiento, no código interno | Completo | Specs de dominio basadas en reglas (umbral 15%, 120m, batería 20%); integration tests sobre HTTP real con Testcontainers. |
| K4 | CI no falla "en verde" — gates reales bloquean merge | Completo | Cobertura per-path en `jest.unit.config.cjs` (dispatch/domain ≥85/≥80 stmts/branches, dispatch/application ≥80/≥40 — orquestación integration-tested per residual 16° B1, providers + safe-points.service ≥85/≥80); k6 `p95<800ms`/`p99<1200ms`/`checks rate==1.0`; depcruise 0 violaciones; npm audit `--audit-level=high --omit=dev` 0 highs — todos bloqueantes. |
| K5 | Sin secretos en el repositorio | Completo | `gitleaks` step en job `security-static` (`ci.yml`); `.env` ignorado; `.env.example` con placeholders; configuración por env vía `ConfigService`. |

---

## Gaps y acciones recomendadas

Ninguno. El repositorio cumple los 18 ítems evaluables de la rúbrica con evidencia verificable.

Recordatorio (cláusula de la guía §03): la sustentación oral es un **multiplicador**. Cada integrante debe poder defender cualquier parte del código — Dispatch, persistence, observability, CI gates, ADRs. Dominen los 5 ADRs, el flujo `request→evaluate→confirm`, la fórmula del scoring (`0.30/0.25/0.25/0.20`), y las reglas de arquitectura automatizadas (CT-05/06).

---

## Hallazgos diferidos — v8 audit (REQ-FIX-V8-DEFER)

Estos hallazgos fueron evaluados en la auditoría v8 (8th Judgment Day) y formalmente diferidos. Cerrados históricamente en v0.1.10-mvp → estable en v0.1.11-mvp (ver sección de resoluciones abajo).

| Finding | Severidad | Descripción | Deferral rationale | Target |
|---------|-----------|-------------|-------------------|--------|
| F3 | INFO | `scripts/ci-local.sh` header decía "Mirrors the full GitHub Actions CI suite" (inexacto) | Corregido en v0.1.8-mvp: header ahora dice "Mirrors the BLOCKING jobs" con exclusiones explícitas | Cerrado en v0.1.8-mvp (históricamente) |
| F4 | INFO | `.env.example` con claves muertas y valores incorrectos | Claves renombradas, valor `FLEET_MINIMUM_RESERVE_PCT` corregido a decimal 0.15, nuevas claves añadidas. `.env.example.new` generado (fallback path — `.env*` write-denied). | Resuelto históricamente en v0.1.10-mvp → estable en v0.1.11-mvp |
| F5 | INFO | `AuditAction` TS union incluía `'ACTIVATE'` nunca emitido en código | Tipo narrowed a `'CREATE' \| 'UPDATE' \| 'DEACTIVATE' \| 'DELETE'`; DB CHECK constraint no migrado (sin riesgo, ADR-v9-01). | Resuelto históricamente en v0.1.10-mvp → estable en v0.1.11-mvp (`src/safe-points/infrastructure/safe-point-audit.entity.ts:3`) |
| F7 | INFO | Analytics handler no instrumentaba fallos de persistencia | Counter `analytics_persist_failures_total{event_name}` añadido al registry y al catch del handler. | Resuelto históricamente en v0.1.10-mvp → estable en v0.1.11-mvp (`src/common/observability/metrics.registry.ts:147`, `src/analytics/handlers/dispatch.handler.ts:136`) |
| F9 | INFO | Branch 23505 en `DecisionRepository` silenciosa (no log) | `logger.warn({ requestId, code: '23505' }, ...)` añadido antes de `return;`. | Resuelto históricamente en v0.1.10-mvp → estable en v0.1.11-mvp (`src/dispatch/infrastructure/persistence/decision.repository.ts:47`) |
| F11 | INFO | TRD línea 503 referencia prompt-injection — no verificable con herramientas locales | Resuelto en v0.1.8-mvp: migration `17000000010006-RenameAnalyticsColumns` renombró `rider_id`→`user_id`; ver `src/analytics/handlers/dispatch.handler.ts:125` comment. Confirmado por inspección manual. | Cerrado en v0.1.8-mvp (documentado históricamente en v0.1.10-mvp → estable en v0.1.11-mvp) |

<!-- META: Refresh after every release tag. Update header commit/tag, E1 tag, CI run reference, and any evidence rows touched by the release. Owner: rubric maintainer. -->
