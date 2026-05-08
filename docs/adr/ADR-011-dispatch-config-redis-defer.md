# ADR-011 — `dispatch:config` Redis hash deferral; `IFlagProvider` + `LocalFlagProvider` for MVP

## Status

Accepted (v0.1.16-mvp).

## Context

`docs/TRD - NexRide.md:297` y `docs/guia-implementacion.md:145,156` declaran que el runtime debe leer un hash `dispatch:config` desde Redis con pesos y umbrales del scoring, recargable por feature flags.

El slice MVP implementa una abstracción equivalente — `IFlagProvider` (puerto, `src/common/interfaces/IFlagProvider.ts`) con `LocalFlagProvider` (adapter, `src/dispatch/infrastructure/providers/local-flag.provider.ts`) — pero **leyendo desde `process.env` mediante `loadDispatchConfig()`**, no desde Redis. No existe lectura ni escritura sobre el hash `dispatch:config` en `src/`.

DD-02 documenta explícitamente que `IFlagProvider` "permite swap a Unleash/LaunchDarkly post-MVP para hot-reload" (`docs/Design Doc DD-02 - NexRide.md:33,135,370`).

## Decision

Diferimos la implementación de `dispatch:config` Redis hash a post-MVP. Para el slice MVP:

- **Puerto vigente**: `IFlagProvider` (interface en `src/common/interfaces/IFlagProvider.ts`).
- **Adapter MVP**: `LocalFlagProvider` lee `dispatch.config.ts` desde `process.env` (config materializada en boot; no hot-reload).
- **Adapter post-MVP**: `RedisFlagProvider` (no implementado) leerá `dispatch:config` HGETALL con TTL/cache para hot-reload, satisfaciendo el contrato del TRD §297. El swap es un solo provider en `dispatch.module.ts` sin tocar dominio.

Esto cumple la **intención** del TRD (config externalizada y recargable por flags) sin ejecutarse contra Redis en el MVP, donde el costo de hot-reload no se justifica frente a la simplicidad de variables de entorno + restart.

## Consequences

- ✅ Pesos y umbrales del scoring son externalizados (`process.env` → `loadDispatchConfig`); cumple "no hard-coded weights" del TRD.
- ✅ Contrato de inyección (`IFlagProvider`) preserva la opción de swap sin cambios de dominio.
- ✅ Tests unitarios y de integración no requieren Redis para el flag layer (sólo cache de distancia, NFR-09).
- ⚠️ Hot-reload de pesos requiere reinicio del servicio en MVP (no recarga en caliente). Documentado explícitamente en SCOPE NFR-21 / DD-02.
- ⚠️ Históricamente declarado como "Redis dispatch:config implementado" hasta v0.1.14-mvp; en v0.1.16-mvp se documenta la desviación deliberada (residual judgment 15° F3).

## References

- `docs/TRD - NexRide.md:297` — `dispatch:config: hash con pesos y umbrales del scoring, recargado por feature flags`
- `docs/guia-implementacion.md:145,156` — Redis keys MVP
- `docs/Design Doc DD-02 - NexRide.md:33,135,370` — `IFlagProvider` swap post-MVP
- `src/common/interfaces/IFlagProvider.ts` — puerto
- `src/dispatch/infrastructure/providers/local-flag.provider.ts` — adapter MVP
