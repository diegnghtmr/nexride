# ADR-010 — `dispatch_cancelled_total` counter deferral

## Status

Accepted (v0.1.12-mvp).

## Context

En el SDD `nexride-rubric-residuals-v11` (Judgment Day 11°, F2) se cerró RTF-32 agregando el evento `dispatch.cancelled` y su `DispatchAnalyticsHandler.onCancelled()`. La spec original consideraba además agregar un counter de Prometheus `dispatch_cancelled_total` simétrico a `dispatch_completed_total` en `metrics.registry.ts`.

El alcance de PR-B es **wire-only**: el evento se registra y persiste en `analytics_events` cuando se emite, pero NO existe todavía un sitio de emisión productivo (la cancelación de viajes es **RTF-26 Parcial / post-MVP**, ver `SCOPE.md:42`). Históricamente el contrato declaraba el evento pero el flujo no llegó a implementarse en el corte vertical del MVP.

## Decision

Diferimos `dispatch_cancelled_total` (Prom counter) hasta que exista un sitio de emisión real (RTF-26 post-MVP). Mientras tanto:

- El conteo de cancelaciones es derivable directamente vía `SELECT count(*) FROM analytics_events WHERE event_name = 'dispatch.cancelled'`.
- No se introduce asimetría operativa: con cero emisiones, un counter quedaría plano y daría falsa señal de "métrica activa".
- Cuando RTF-26 se materialice, el counter se agrega en el mismo PR del flujo de emisión, junto al sitio que llama `eventEmitter.emit(DispatchEventName.Cancelled, ...)`.

## Consequences

**Positivas**:
- Métricas Prometheus consistentes: cada counter en `metrics.registry.ts` tiene un sitio de incremento real.
- Evita ruido en dashboards: un counter siempre en 0 confunde más de lo que ayuda.
- El conteo histórico no se pierde — `analytics_events` lo retiene.

**Negativas**:
- Quien quiera el counter en el momento que RTF-26 aterrice deberá agregar 3 líneas (declaración en `DispatchMetrics`, registro en `createMetricsRegistry`, `inc()` en el sitio de emisión).
- El Design Doc DD-02 §282 (tabla de métricas) no incluye `dispatch_cancelled_total` — alineado con esta decisión.

## Reference

- SDD: `sdd/nexride-rubric-residuals-v11`
- Spec engram: #1171
- Verify report engram: #1176 (WARNING-01)
- Históricamente: la decisión de wire-only (sin counter activo) se tomó en este SDD; previo a v0.1.12-mvp el evento `dispatch.cancelled` no existía en absoluto.
