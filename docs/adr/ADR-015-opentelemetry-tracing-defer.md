# ADR-015 — OpenTelemetry tracing diferido a post-MVP (sin colector backend)

**Estado**: Aceptado · v0.1.22-mvp
**Fecha**: 2026-05-22
**Supersede / Amend**: aclara el estado histórico de NFR-21 documentado como "Parcial — SDK instalado, bootstrap pendiente" en v0.1.0..v0.1.21-mvp.

## Contexto

El TRD §7.5 NFR-21 prescribe "Tracing distribuido con OpenTelemetry para identificar cuellos de botella en el flujo de despacho". Hasta v0.1.21-mvp, el repositorio declaraba esta capacidad como **Parcial**: el paquete `@opentelemetry/sdk-node@0.52.1` estaba listado en `dependencies` pero `NodeSDK.start()` nunca se invocaba en `src/main.ts`. El SDK quedaba inerte.

Un juez ciego (judgment 21°) flagueó esto como MEDIUM, observando que la diferencia entre "SDK instalado" y "tracing operativo" es total: sin `NodeSDK.start()` el SDK no captura ningún span, lo cual es equivalente a no tener tracing.

## Decisión

1. **Mover `@opentelemetry/sdk-node` desde `dependencies` a `devDependencies`.** El package permanece en el lockfile y disponible para el equipo, pero no entra en el artefacto de producción (`npm ci --omit=dev` lo excluye).
2. **Reclasificar NFR-21 de `Parcial` a `Fuera de Alcance — requiere colector backend de tracing`** en `SCOPE.md`, `README.md`, `docs/rubric-checklist.md` y `docs/traceability-matrix.md`.
3. **Swap-back a `Implementado` requiere un único PR** que:
   - Mueva el paquete de vuelta a `dependencies`.
   - Agregue un nuevo módulo de tracing en `src/common/observability/` (e.g. archivo `tracing` no existente hoy) con `NodeSDK` configurado contra el exporter del backend elegido (Jaeger / Tempo / Honeycomb / OTLP collector).
   - Invoque la inicialización antes de `bootstrap()` en `main.ts`, gated por `OTEL_ENABLED=true`.

## Justificación técnica

- **Sin colector, el tracing no produce valor**. Aunque arrancáramos `NodeSDK.start()` con un `ConsoleSpanExporter`, los spans saldrían por stdout mezclados con logs Pino, sin agregación ni búsqueda. El instrumento no produciría insight observacional real.
- **Mantener un SDK inerte en `dependencies` es ruido de auditoría**. Cada `npm audit` y cada review escanea ese paquete; cada bundle de producción lo incluye. Cuesta espacio, atrae findings adversariales, y no entrega valor.
- **Coherente con ADR-001, ADR-002, ADR-003, ADR-005, ADR-007 y ADR-011**: el slice MVP prefiere primitivas técnicas reales con swap documentado sobre artefactos cosméticos que prometen capacidades que no entrega.
- **Cobertura observacional vigente**: NFR-18 (logs estructurados JSON con `request_id`/`trip_id`/`user_id`) y NFR-19 (25+ métricas Prometheus con histogramas calibrados por fase) cubren el caso de uso "identificar cuellos de botella" para el slice MVP a través de métricas y logs correlacionados. El tracing distribuido es valor incremental marginal en un monolito modular sin extracción a microservicios.

## Consecuencias

- `package.json` `dependencies` queda con 23 entradas (antes 24); `devDependencies` agrega 1 entrada.
- La autoevaluación SCOPE §1 reporta ahora **0 NFR Parcial** en lugar de 1 — la entrega no tiene ítems Parcial pendientes de bootstrap.
- `verify-doc-consistency.sh` continúa pasando: NFR-21 está alineado en SCOPE.md y README.md como `Fuera de Alcance`.
- La rúbrica `docs/rubric-checklist.md` queda en **18/18 Completo** (incluyendo NFR-21 como Fuera de Alcance declarado, equivalente a las demás NFRs de infra fuera del slice — NFR-02..08, NFR-11..14, NFR-20).
- Cuando exista pipeline de observabilidad real (Jaeger/Tempo/Honeycomb), el swap-back es un PR de ~50 LOC.

## Alternativas consideradas y descartadas

- **Bootstrap con `ConsoleSpanExporter`**: los spans terminan en stdout y se mezclan con Pino. No es agregable ni buscable. Pierde el propósito de NFR-21.
- **Bootstrap con un OTLP collector dummy en docker-compose**: agrega un servicio más al entorno local + CI sin valor productivo y duplica funcionalidad de Prometheus (que ya cubre el caso).
- **Mantener `Parcial` con justificación documentada**: el judgment 21° demostró que evaluadores ciegos no aceptan "instalado pero no arrancado" como Parcial creíble — lo leen como Inerte.

## Referencias

- TRD §7.5 NFR-21
- SCOPE.md §2 NFR-21 (post-v0.1.21-mvp), §3 (adaptaciones técnicas)
- README.md tabla de evaluación
- docs/rubric-checklist.md §C4
- Judgment 21° dual-judge verdict (Juez A finding 4, Juez B área de mejora A1)
