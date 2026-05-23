# ADR-014 — `DispatchFacade` como punto de entrada (en lugar de `DispatchService` del DD-01)

**Estado**: Aceptado · v0.1.22-mvp (formaliza decisión histórica desde v0.1.0-mvp)
**Fecha**: 2026-05-22
**Contexto**: judgment 21° Juez A finding 6 — la desviación estaba implementada pero sin ADR específico que la documentara.

## Contexto

El **DD-01 §8.3-§8.4** describe el módulo `dispatch` con un único punto de entrada llamado `dispatch.service.ts` (`@Injectable() export class DispatchService implements IDispatchService`) que el resto de los módulos consume via `@Inject('IFleetService')`. Esta es la convención NestJS-monolito clásica: un Service por módulo, expuesto en `providers`/`exports`.

La implementación real del slice MVP usa **`src/dispatch/dispatch.facade.ts`** como punto de entrada, que delega a dos casos de uso separados:

- `EvaluateDispatchUseCase` — orquesta el pipeline candidatura→filtrado→scoring→decisión→registro (`POST /rides/request`).
- `ConfirmDispatchUseCase` — confirma la elección del rider, crea el trip y persiste `user_choice` (`POST /rides/confirm`).

`DispatchFacade` no contiene lógica de negocio: es un router fino entre los dos casos de uso y la capa controller.

## Decisión

Mantener `DispatchFacade` + use-cases como la arquitectura del módulo Dispatch, en lugar del `DispatchService` monolítico del DD-01. Esta decisión es **deliberada** y obedece a:

1. **Pattern Facade vs Service en hexagonal**: cuando el módulo expone múltiples casos de uso con flujos independientes (evaluate vs confirm), un Facade que delega es preferible a un Service que embeba ambos flujos. Embeber ambos en una sola clase produce un service de >500 LOC con dos responsabilidades — exactamente el "God Service" que los apuntes_calidad del profesor advierten contra.
2. **Alineación con Clean Architecture / Hexagonal**: los use cases son el patrón canónico para representar acciones del actor en la capa de aplicación; el Service NestJS clásico mezcla orquestación con dispatching HTTP.
3. **Testabilidad**: cada use case tiene su propia suite unitaria (`test/unit/dispatch/application/evaluate-dispatch.use-case.spec.ts`, `confirm-dispatch.use-case.spec.ts`) sin necesidad de stubear el otro flujo.
4. **Coherencia con el resto del slice**: `SafePoints`, `Fleet`, `Trip` y `Analytics` tienen `*.service.ts` porque son módulos de una sola responsabilidad (CRUD + audit, read-side, lifecycle, event-handler). Dispatch tiene dos responsabilidades distintas y por eso merece dos use-cases con Facade.

## Consecuencias

- El DD-01 §8.3-§8.4 queda como **diagrama de referencia inicial**, no como contrato literal. Esta ADR formaliza la desviación que ya estaba implementada desde v0.1.0-mvp.
- `IDispatchService` no existe como interfaz pública del módulo. Los consumidores externos invocan `DispatchFacade` directamente; las reglas `dispatch-no-cross-module-imports` y `siblings-no-import-dispatch-internals` en `.dependency-cruiser.cjs` garantizan que solo `dispatch.facade.ts` (más `dispatch.module.ts` y eventos en `common/events/`) sea importable desde otros módulos.
- Cuando se agreguen nuevos casos de uso del dominio Dispatch (cancelación post-MVP — RTF-26, override manual — RTF-34), serán nuevos `*-use-case.ts` clases delegados desde `DispatchFacade`; no se infla la fachada con lógica de negocio.

## Alternativas consideradas y descartadas

- **Renombrar `DispatchFacade` a `DispatchService`** para alinear nombres literales con el DD-01: rompería el contrato semántico del patrón Facade (un Service hace trabajo; un Facade delega) y haría más confusa la lectura del módulo.
- **Reescribir el DD-01 para listar use-cases en lugar de service**: el DD-01 es un documento histórico contractual; modificarlo retrospectivamente sin marcar la desviación es deshonesto. Esta ADR documenta el delta sin reescribir el contrato original.
- **Mantener la desviación sin ADR (estado v0.1.0..v0.1.21-mvp)**: judgment 21° Juez A flagueó el gap. La ausencia de ADR genera duda razonable en revisores que comparan código contra DD-01.

## Referencias

- DD-01 §8.3-§8.4 (módulo Dispatch — referencia histórica)
- `src/dispatch/dispatch.facade.ts` — implementación actual
- `src/dispatch/application/evaluate-dispatch.use-case.ts`
- `src/dispatch/application/confirm-dispatch.use-case.ts`
- `.dependency-cruiser.cjs` reglas `dispatch-no-cross-module-imports` + `siblings-no-import-dispatch-internals`
- Apuntes profesor `docs/apuntes_diseno_orientado_a_objetos_actualizado.md` — Pattern Facade y SRP
- Judgment 21° dual-judge verdict (Juez A finding 6)
