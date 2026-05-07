# SDD de implementación parcial priorizada para NexRide

## Propósito y criterio rector

Este SDD define una implementación **intencionalmente parcial pero completa en evidencia** para el entregable de **Código + Pruebas + CI**, construida para respetar el contrato técnico de NexRide y maximizar la rúbrica de evaluación sin intentar desarrollar todo el producto. La guía exige que el repositorio contenga código, pruebas y CI; que exista un archivo de alcance declarado obligatorio; que el pipeline corra automáticamente en cada push/PR con build, pruebas y análisis estático; y que la calificación se concentre en cuatro dimensiones: código, pruebas, CI y coherencia con PRD/RFC/TRD/Design Docs. La misma guía también aclara que la nota final sigue dependiendo de la sustentación oral como multiplicador, por lo que ningún repositorio, por sí solo, garantiza una nota perfecta si el equipo no domina lo construido. fileciteturn0file3

La decisión arquitectónica correcta, entonces, no es “implementar todo NexRide”, sino **implementar el corte vertical que produzca la mayor evidencia técnica por unidad de esfuerzo**, dejando explícitamente fuera lo que no es necesario para demostrar cumplimiento. Ese corte vertical debe respetar que NexRide se concibe como un monolito modular en NestJS y TypeScript, con PostgreSQL + PostGIS, Redis, contratos entre módulos por interfaces/eventos, y con la lógica de despacho concentrada exclusivamente en el módulo Dispatch. fileciteturn0file1 fileciteturn0file2

El motivo para centrar la solución alrededor de Dispatch no es arbitrario. El PRD, el RFC y el DD-02 coinciden en que el **motor de despacho contextual** es el principal diferenciador del MVP: evalúa batería, elegibilidad del conductor, seguridad del punto de abordaje y continuidad de flota, en lugar de asignar simplemente el vehículo más cercano. Además, el DD-02 lo describe como el componente central de diferenciación y el TRD concentra allí un bloque completo de requisitos técnicos funcionales y no funcionales de alto valor para la evaluación. fileciteturn0file5 fileciteturn0file4 fileciteturn0file0 fileciteturn0file2

Por lo anterior, este SDD se formula con un objetivo preciso: **cubrir el 100 % de lo evaluable del entregable dentro de un alcance declarado claro**, no el 100 % del producto completo. Eso significa que el repositorio deberá demostrar, de manera verificable, arquitectura consistente, reglas de negocio centrales, observabilidad, manejo de errores, pruebas útiles, quality gates reales y trazabilidad documental sin contradicciones. fileciteturn0file3 fileciteturn0file1 fileciteturn0file2

## Alcance objetivo para maximizar la rúbrica

El alcance recomendado es un **vertical slice backend** compuesto por **Dispatch + SafePoints backend + Fleet read-side para despacho + confirmación mínima de Trip + Analytics del flujo cubierto + observabilidad, pruebas y CI**. Este corte es el mejor balance entre profundidad técnica y tamaño del entregable, porque permite demostrar las decisiones clave del DD-01 y DD-02, cubrir el núcleo funcional del RFC/PRD, y construir evidencia suficiente para las cuatro partes de la rúbrica. fileciteturn0file0 fileciteturn0file1 fileciteturn0file2 fileciteturn0file3

| Dominio | Estado propuesto | Cobertura |
|---|---|---|
| Dispatch | Implementado completo | RTF-16 a RTF-22 |
| SafePoints backend | Implementado completo | RTF-23 a RTF-25 |
| Fleet de soporte al despacho | Implementado parcial-alto valor | RTF-14 y RTF-15 completos; RTF-13 parcial mediante adaptador/fixtures y contrato |
| Trip mínimo | Implementado parcial | RTF-28 completo; RTF-26 y RTF-27 parciales para el flujo `requested -> assigned` |
| Analytics del flujo cubierto | Implementado completo en alcance | RTF-31 y RTF-32 para eventos del flujo implementado |
| Seguridad, observabilidad y resiliencia en el backend del alcance | Implementado | NFR-01, NFR-09, NFR-10, NFR-17 (implementado: rate limiting dos niveles — usuario 100/min, IP 1000/min — en `src/app.module.ts:60-86` + `src/common/guards/configurable-throttler.guard.ts` desde v0.1.9-mvp), NFR-18, NFR-19, NFR-20 y NFR-21 en lo aplicable al corte vertical |
| Coherencia documental | Implementado | Trazabilidad explícita a PRD, RFC, TRD, DD-01 y DD-02 |

La tabla anterior deriva directamente del hecho de que el TRD exige el motor de despacho contextual, SafePoints y el registro analítico de decisiones; que el DD-01 obliga a mantener las fronteras modulares; y que la guía permite omisiones siempre que queden declaradas y justificadas en el alcance. fileciteturn0file2 fileciteturn0file1 fileciteturn0file3

Quedan **fuera de alcance** del entregable recomendado: registro OTP/SMS, apps móviles, WebSocket de rastreo en tiempo real, notificaciones push, pagos, panel web de operaciones, ciclo completo del viaje más allá de la asignación mínima, integración viva con proveedores externos, y métricas operativas de alcance total del producto. La justificación no es que “no importen”, sino que **no son necesarias para demostrar con calidad el cumplimiento de la guía** si el alcance declarado documenta con precisión qué sí se implementó y qué no. Además, el propio TRD y DD-01 permiten una implementación por fases, y el DD-01 ubica Dispatch/SafePoints como la Fase 2 de alto valor sobre una base modular. fileciteturn0file3 fileciteturn0file1 fileciteturn0file2

La promesa funcional mínima que sí debe quedar totalmente operativa y demostrable es esta: **un rider autenticado por contexto de prueba solicita un viaje, el sistema evalúa candidatos y puntos seguros, genera una decisión por requestId, permite confirmar el punto original o sugerido, crea el trip mínimo asociado, registra la elección del usuario y emite los eventos/observabilidad correspondientes**. Esa promesa es suficiente para defender arquitectura, reglas de negocio, persistencia, eventos, errores, pruebas, CI y trazabilidad. fileciteturn0file0 fileciteturn0file1 fileciteturn0file2

## Diseño detallado de la solución

La solución debe respetar de forma estricta dos restricciones del contrato técnico: **toda la lógica de negocio del despacho vive en Dispatch** y **la comunicación entre módulos ocurre solo por interfaces inyectadas o por eventos del bus interno, nunca por importaciones directas de repositorios cruzados**. Esa restricción no es decorativa; debe convertirse en una regla de diseño y en una regla automatizada del repositorio. fileciteturn0file2 fileciteturn0file1

La estructura recomendada del repositorio, manteniendo coherencia con DD-01 y refinando el módulo Dispatch para volverlo altamente testeable, es la siguiente. fileciteturn0file1 fileciteturn0file0

```text
nexride-mvp/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── common/
│   │   ├── config/
│   │   ├── events/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── interfaces/
│   │   ├── observability/
│   │   └── errors/
│   ├── rider/
│   │   ├── rider.module.ts
│   │   ├── rider.controller.ts
│   │   └── dto/
│   ├── dispatch/
│   │   ├── dispatch.module.ts
│   │   ├── dispatch.facade.ts
│   │   ├── application/
│   │   │   ├── evaluate-dispatch.use-case.ts
│   │   │   └── confirm-dispatch.use-case.ts
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   └── services/
│   │   │       ├── candidate-generator.ts
│   │   │       ├── candidate-filter.ts
│   │   │       ├── scoring-engine.ts
│   │   │       ├── decision-maker.ts
│   │   │       ├── fallback-handler.ts
│   │   │       └── decision-recorder.ts
│   │   └── infrastructure/
│   │       ├── persistence/
│   │       ├── providers/
│   │       └── mappers/
│   ├── fleet/
│   │   ├── fleet.module.ts
│   │   ├── fleet.service.ts
│   │   └── infrastructure/
│   ├── safe-points/
│   │   ├── safe-points.module.ts
│   │   ├── safe-points.controller.ts
│   │   ├── safe-points.service.ts
│   │   └── infrastructure/
│   ├── trip/
│   │   ├── trip.module.ts
│   │   ├── trip.service.ts
│   │   └── infrastructure/
│   └── analytics/
│       ├── analytics.module.ts
│       ├── analytics.service.ts
│       └── handlers/
├── migrations/
├── test/
│   ├── unit/
│   ├── integration/
│   ├── architecture/
│   └── performance/
├── .github/workflows/
├── README.md
├── SCOPE.md
└── package.json
```

La pieza central es `dispatch.facade.ts`, invocada internamente desde `rider.controller.ts`; **no debe exponerse un endpoint público dedicado del tipo `/dispatch/request`**, porque el DD-02 indica que el pipeline se invoca internamente desde Rider dentro de una solicitud autenticada. El request externo correcto para el corte implementado es `POST /rides/request`, y la confirmación debe vivir en `POST /rides/confirm`, usando `requestId` como correlación primaria antes de que exista `tripId`. fileciteturn0file0 fileciteturn0file1

Los componentes del dominio de Dispatch deben quedar particionados así:

| Componente | Responsabilidad principal | Dependencias permitidas |
|---|---|---|
| `EvaluateDispatchUseCase` | Orquestar el pipeline completo | `IFleetService`, `ISafePointsService`, `DistanceProvider`, `FlagProvider`, `DecisionRepository`, `EventBus` |
| `CandidateGenerator` | Obtener vehículos y safe points en paralelo | `IFleetService`, `ISafePointsService` |
| `CandidateFilter` | Excluir candidatos por batería, elegibilidad, estado y telemetría obsoleta | `DispatchConfig` |
| `ScoringEngine` | Calcular `proximity`, `energy`, `safety`, `continuity` y score total | `DistanceProvider`, `DispatchConfig` |
| `DecisionMaker` | Elegir mejor combinación y decidir si se muestra sugerencia | `DispatchConfig` |
| `FallbackHandler` | Resolver degradación controlada | `IFleetService`, `DispatchConfig` |
| `DecisionRecorder` | Persistir predecisión por `requestId` y luego actualizar con `tripId` y `userChoice` | repositorios del propio módulo |
| `ConfirmDispatchUseCase` | Validar `requestId`, crear trip mínimo, actualizar decisión y publicar eventos | `ITripService`, `DecisionRepository`, `EventBus` |

Esta partición implementa literalmente la secuencia del DD-02 — candidatura, filtrado, scoring y registro — y a la vez cumple la modularidad exigida por DD-01 y TRD. fileciteturn0file0 fileciteturn0file1 fileciteturn0file2

El flujo funcional propuesto debe ser el siguiente. Primero, `POST /rides/request` recibe origen, destino y contexto autenticado del rider. Segundo, Dispatch consulta en paralelo vehículos disponibles en radio configurable y safe points dentro de 120 metros. Tercero, filtra por batería insuficiente, vehículo fuera de servicio, conductor no elegible o telemetría vencida. Cuarto, calcula una matriz de combinaciones candidato-punto. Quinto, aplica el score compuesto con pesos configurables: proximidad `0.30`, energía `0.25`, seguridad `0.25` y continuidad `0.20`. Sexto, compara el punto original contra el sugerido usando un baseline de seguridad del punto original de `0.3`, salvo que el origen ya coincida con un punto curado. Séptimo, solo muestra sugerencia si la mejora relativa en seguridad es al menos `15 %` y la caminata no supera `120 m`. Octavo, persiste la decisión preliminar por `requestId` y emite eventos analíticos. Noveno, `POST /rides/confirm` confirma elección `original | suggested`, crea el trip mínimo y actualiza la misma decisión con `tripId` y `userChoice`. fileciteturn0file0 fileciteturn0file2 fileciteturn0file4

Donde el contrato técnico exige un factor pero no fija una fórmula exacta, este SDD concreta una implementación simple, defendible y compatible con el MVP. El score total será `Σ(score_i * peso_i)`. `proximity_score` será la normalización inversa del ETA calculado por lote; `energy_score` será la relación entre autonomía disponible y autonomía requerida con reserva mínima; `safety_score` saldrá del catálogo curado o del baseline para el punto original; y `continuity_score` se implementará, por alcance, como una combinación del porcentaje de batería remanente proyectada después del viaje y un factor estático de continuidad por zona leíble desde configuración, sin entrar todavía en optimización multi-viaje o predicción de demanda, que el DD-02 explícitamente deja fuera del MVP. fileciteturn0file0 fileciteturn0file2

Los parámetros de configuración que deben quedar externalizados, sin hardcoding, son los siguientes. Esta configuración cumple tanto el TRD como la guía, que castiga secretos o thresholds vacíos y espera NFRs visibles en código. fileciteturn0file2 fileciteturn0file3

| Parámetro | Valor inicial |
|---|---|
| `dispatch.candidateRadiusKm` | `5` |
| `dispatch.safePointRadiusM` | `120` |
| `dispatch.suggestionThresholdPct` | `0.15` |
| `dispatch.originalSafetyBaseline` | `0.30` |
| `dispatch.weights.proximity` | `0.30` |
| `dispatch.weights.energy` | `0.25` |
| `dispatch.weights.safety` | `0.25` |
| `dispatch.weights.continuity` | `0.20` |
| `dispatch.pipelineTimeoutMs` | `1200` |
| `dispatch.fallbackMinBatteryPct` | `20` |
| `fleet.minimumReservePct` | `15` |
| `fleet.telemetryStalenessSec` | `60` |
| `distance.cacheTtlSec` | `60` |

En persistencia, el corte vertical debe usar PostgreSQL + PostGIS para datos transaccionales y geoespaciales, y Redis para estado de flota y cachés rápidos. Las tablas mínimas obligatorias son `dispatch_decisions`, `safe_points`, `safe_point_audit`, `trips` en versión mínima y `analytics_events`; en Redis deben existir `fleet:geo`, `fleet:vehicles:{vehicleId}` y `dispatch:config`. La decisión de despacho debe persistirse en dos etapas: primero con `requestId`, luego actualizada con `tripId` y la opción elegida por el usuario. fileciteturn0file2 fileciteturn0file1 fileciteturn0file0

| Recurso | Uso en el alcance |
|---|---|
| `dispatch_decisions` | Guarda candidatos evaluados, scores, ganador, sugerencia, fallback, tiempos, `requestId`, `tripId`, `userChoice` |
| `safe_points` | Catálogo curado con ubicación, razón, zona y estado |
| `safe_point_audit` | Auditoría de creación, edición, activación/desactivación y eliminación |
| `trips` | Trip mínimo creado desde `requestId`, con `pickup_type` y `suggested_point_id` |
| `analytics_events` | Eventos del flujo cubierto: request creada, sugerencia mostrada, aceptada/rechazada, fallback activado, viaje asignado |
| `fleet:geo` | Índice geoespacial de vehículos disponibles |
| `fleet:vehicles:{id}` | Estado operativo, batería, elegibilidad y timestamp de snapshot |
| `dispatch:config` | Configuración materializada para runtime y tests |

La observabilidad no debe quedar como comentario, sino como comportamiento implementado. Todos los flujos críticos deben emitir logs JSON con `timestamp`, `level`, `module`, `request_id`, `trip_id`, `user_id`, `zone_id`, `message` y `metadata`. También deben exponerse métricas como `dispatch_pipeline_duration_ms`, `dispatch_phase_candidature_duration_ms`, `dispatch_phase_filter_duration_ms`, `dispatch_phase_scoring_duration_ms`, `dispatch_candidates_initial`, `dispatch_candidates_after_filter`, `dispatch_suggestion_generated`, `dispatch_suggestion_accepted`, `dispatch_suggestion_rejected` y `dispatch_fallback_activated`. El campo `scores_json` en `dispatch_decisions` debe permitir reconstruir por completo una decisión concreta durante la sustentación y las pruebas de soporte. fileciteturn0file0 fileciteturn0file1 fileciteturn0file2

El manejo de errores y contingencia debe modelarse desde el dominio y quedar visible en pruebas. La propuesta recomendada es la siguiente. fileciteturn0file0 fileciteturn0file2

| Situación | Respuesta funcional | Código/efecto esperado |
|---|---|---|
| No hay vehículos en radio | Intentar fallback si aplica; si no, indisponibilidad | `422` controlado con evento `dispatch.no_availability` |
| Todos los candidatos fallan por filtro | Activar fallback simplificado | decisión registrada con `fallback_reason` |
| Timeout del proveedor de distancias | Reutilizar caché; si no existe, Haversine; si falla, fallback | `WARN` + métrica de degradación |
| No hay safe points dentro de 120 m | Evaluar solo el punto original | sin sugerencia, no es error |
| `requestId` inexistente o expirado al confirmar | Rechazar confirmación | `404` o `409` según caso |
| Confirmación concurrente del mismo `requestId` | Bloquear doble consumo | `409` con control transaccional |
| Edición de safe point sin motivo | Rechazar operación | `400` |
| Cambio de safe point sin RBAC válido | Rechazar operación | `403` |

Para seguridad, el corte implementado no necesita desarrollar todo Auth, pero sí debe reflejar las restricciones del contrato: sin secretos en repositorio, configuración por ambiente, rider proveniente del contexto autenticado y RBAC real en endpoints de SafePoints para roles `supervisor` y `administrador`. El RFC además obliga a que la razón mostrada al usuario sea de **mejora relativa** y no de garantía absoluta. Por eso el texto de sugerencia debe ser del estilo “mejor iluminación” o “mayor flujo peatonal”, nunca “punto seguro garantizado”. fileciteturn0file3 fileciteturn0file2 fileciteturn0file4 fileciteturn0file0

## Estrategia TDD y plan de pruebas

La implementación debe seguir **TDD real**, no “tests al final”. El patrón recomendado es **outside-in para el flujo principal** y **inside-out para las reglas matemáticas del scoring**. Es decir: primero se escribe el failing test del comportamiento observable del caso de uso, luego los unit tests de los componentes internos que obligan a construir el dominio, y por último se refactoriza dejando el contrato HTTP, el dominio y la persistencia limpios. Este enfoque es consistente con la guía, que pide pruebas de comportamiento y no de detalles internos, y con el TRD, que exige pruebas unitarias, de integración y de performance. fileciteturn0file3 fileciteturn0file2

La secuencia de iteraciones TDD recomendada es esta:

| Iteración | Failing test inicial | Resultado esperado |
|---|---|---|
| Corte de entrada | `POST /rides/request` responde `201` con `requestId`, alternativa y metadata | Vertical slice mínimo vivo |
| Candidatura | dados vehículos y puntos, se consultan en paralelo y se limitan por radio | `CandidateGenerator` listo |
| Filtrado | candidatos con batería insuficiente, sin elegibilidad, fuera de servicio o telemetría vencida son excluidos | `CandidateFilter` listo |
| Scoring | el motor selecciona la mejor combinación según pesos y desempates definidos | `ScoringEngine` + `DecisionMaker` listos |
| Sugerencia | solo se muestra cuando la mejora relativa supera el umbral y la caminata no excede 120 m | regla UX/negocio defendible |
| Fallback | timeout o falta de candidatos dispara degradación controlada y registro analítico | resiliencia demostrable |
| Confirmación | `POST /rides/confirm` actualiza decisión y crea trip mínimo según `userChoice` | cierre transaccional del flujo |
| SafePoints | CRUD con auditoría y RBAC | evidencia de módulo adyacente y NFRs |
| Observabilidad | logs, métricas y eventos quedan visibles y testeados | NFRs en código |
| Hardening | performance smoke, arquitectura y seguridad estática | calidad de entrega |

El plan de pruebas debe cubrir cinco familias. **Pruebas unitarias** con Jest sobre el dominio de Dispatch, Fleet de soporte, SafePoints y Trip mínimo; **pruebas de integración** con PostgreSQL/PostGIS y Redis reales, más Supertest para los endpoints; **pruebas de arquitectura** para garantizar las fronteras modulares; **pruebas de performance** con k6; y **análisis estático de seguridad/calidad** sobre dependencias, secretos y convenciones. El TRD exige cobertura mínima del 80 % en la lógica de negocio y al menos 15 escenarios sobre el motor de scoring; este SDD sube el objetivo a un estándar más defendible: **mínimo 20 escenarios unitarios de Dispatch** y gates de cobertura más estrictos para el código del alcance. fileciteturn0file2 fileciteturn0file3

| Suite | Qué valida | Gate mínimo |
|---|---|---|
| Unit | reglas puras: radio, batería, baseline 0.3, pesos, umbral 15 %, fallback, correlación `requestId` | `>= 85 %` statements, `>= 80 %` branches en módulos del alcance |
| Integration | endpoints, migraciones, PostGIS, Redis, transacciones, auditoría, eventos | todas las specs verdes |
| Architecture | no importaciones cruzadas de repositorios/servicios fuera de interfaces/eventos | `0` violaciones |
| Performance smoke | latencia del flujo principal en escenario controlado | `p95 <= 800 ms`, `p99 <= 1200 ms` |
| Static/Security | lint, typecheck, dependencias, secretos | `0` errores de lint, `0` type errors, `0` high/critical vulns, `0` secretos expuestos |

Los casos unitarios obligatorios del motor deben incluir, como mínimo: vehículo fuera de radio; batería exacta al límite con reserva; batería insuficiente; candidato elegible vs no elegible; telemetría vencida; vehículo fuera de servicio; empate de score; un único candidato viable; ausencia de safe points; safe point original ya catalogado; mejora en seguridad menor al 15 %; mejora exacta del 15 %; caminata mayor a 120 m; timeout del proveedor de distancias; fallback por timeout; fallback por ausencia de candidatos; confirmación con punto original; confirmación con punto sugerido; doble confirmación; y lectura correcta de pesos/configuración. Con esto se excede de forma razonable el mínimo pedido por el TRD y se alinea con la guía, que exige happy path, flujos de error y casos límite. fileciteturn0file2 fileciteturn0file3

Las pruebas de integración deben levantar PostgreSQL con PostGIS y Redis, ejecutar migraciones y validar: creación y consulta geoespacial de safe points; indexación de flota; `POST /rides/request`; persistencia de `dispatch_decisions`; `POST /rides/confirm`; actualización de `tripId` y `userChoice`; emisión de eventos `trip.assigned`, `dispatch.completed`, `dispatch.fallback_activated`; y auditoría de SafePoints. También debe existir una prueba de error del servicio externo de distancias que valide comportamiento del sistema ante un “500” o timeout, porque la guía explícitamente valora más ese tipo de prueba que la verificación de una llamada interna. fileciteturn0file3 fileciteturn0file2 fileciteturn0file0

La prueba de performance no debe intentar simular producción completa; debe ser un **smoke test serio y repetible** del flujo principal dentro del alcance. La recomendación es un script de k6 que ejecute `POST /rides/request` sobre una base de datos de prueba con una flota semilla y safe points semilla, usando thresholds codificados en el script. El criterio a automatizar es el mismo del contrato: `p95 <= 800 ms` y `p99 <= 1200 ms` para el pipeline de despacho. fileciteturn0file2 fileciteturn0file0

## CI, quality gates y trazabilidad documental

La guía exige que el pipeline viva en el repositorio, corra automáticamente en cada push/PR, diferencie fallos por tipo y tenga al menos un threshold real que bloquee el merge. El TRD, por su parte, pide que el pipeline automatice lint, unit tests, integración de API y análisis estático de dependencias. La mejor respuesta no es un solo job gigante, sino un pipeline con **jobs separados, nombrados y bloqueantes**, cuya lectura sea defendible en la sustentación. fileciteturn0file3 fileciteturn0file2

La propuesta de CI para `.github/workflows/ci.yml` es esta:

| Job | Ejecuta | Evidencia que produce |
|---|---|---|
| `lint-typecheck` | ESLint + Prettier check + `tsc --noEmit` | calidad base del código |
| `architecture-rules` | dependency-cruiser o madge con reglas del DD-01 | coherencia modular automatizada |
| `unit-tests` | Jest unitario con coverage gate | lógica de negocio y TDD |
| `integration-tests` | migraciones + Supertest + PostGIS + Redis | flujo funcional y persistencia |
| `performance-smoke` | k6 con thresholds codificados | NFR-01 automatizado |
| `security-static` | `npm audit --audit-level=high` + gitleaks | seguridad sin secretos ni dependencias críticas |
| `build-openapi` | build del proyecto + generación de Swagger/OpenAPI | CAT-05 y reproducibilidad |

El pipeline debe bloquear el merge si falla cualquiera de estos gates: lint con errores; typecheck con errores; importaciones prohibidas entre módulos; cobertura por debajo del mínimo; pruebas unitarias o de integración fallando; `p95` o `p99` por encima de umbral en k6; vulnerabilidades `high` o `critical`; presencia de secretos; o imposibilidad de generar el `openapi.json`. Con esto, los criterios cuantificables del TRD sí quedan codificados como gates reales, que es exactamente lo que la guía pide. fileciteturn0file3 fileciteturn0file2

Hay un punto especialmente importante para la coherencia documental: las restricciones CT-05 y CT-06 no deben quedar solo en texto; deben convertirse en una **prueba de arquitectura automática**. La regla debe prohibir que `src/dispatch/**` importe repositorios o servicios concretos de `fleet`, `safe-points`, `trip` o `analytics`; solo puede consumir contratos definidos en `src/common/interfaces/**` o eventos de `src/common/events/**`. De la misma forma, el resto de módulos no debe contener lógica de asignación. Esto ataca directamente los criterios “alineación arquitectónica” y “consistencia con el Design Doc”. fileciteturn0file1 fileciteturn0file2 fileciteturn0file3

La trazabilidad documental debe quedar materializada en el repositorio, no solo descrita en este SDD. El mínimo recomendable es un archivo `docs/traceability-matrix.md` o una sección equivalente en `SCOPE.md` con columnas `ID`, `estado`, `ruta de código`, `ruta de prueba`, `desviación`, `justificación`. Esa matriz es la evidencia que responde simultáneamente a las preguntas de alcance declarado, alineación con TRD y coherencia con PRD/RFC/DD. fileciteturn0file3 fileciteturn0file2 fileciteturn0file1

Para que el pipeline sea reproducible desde el repositorio, el `README.md` debe ofrecer una entrada única tipo `npm run ci:local` o `make ci-local` que ejecute los mismos pasos en el mismo orden, además de comandos individuales (`lint`, `test:unit`, `test:integration`, `test:performance`, `audit`, `openapi:generate`). La guía valora explícitamente esa reproducibilidad y penaliza pipelines “verdes” sin valor real. fileciteturn0file3

## Contenido obligatorio de SCOPE y README

`SCOPE.md` es el documento más importante del entregable después del código. La guía dice que, sin un archivo que declare con precisión qué requisitos del TRD se implementaron y cuáles no, la primera dimensión cae al nivel mínimo. Por eso no basta con un párrafo general; `SCOPE.md` debe ser una **matriz exhaustiva, ambigüedad cero**. fileciteturn0file3

La plantilla recomendada para `SCOPE.md` es esta:

| ID | Tipo | Estado | Evidencia de código | Evidencia de prueba | Justificación |
|---|---|---|---|---|---|
| RTF-16 | Funcional | Implementado | `src/dispatch/...` | `test/unit/...`, `test/integration/...` | generación de candidatos en radio |
| RTF-17 | Funcional | Implementado | `candidate-filter.ts` | specs unitarias e integración | filtrado por batería/elegibilidad/estado |
| RTF-18 | Funcional | Implementado | `safe-points.service.ts`, `scoring-engine.ts` | e2e + integración geoespacial | puntos dentro de 120 m |
| ... | ... | ... | ... | ... | ... |

En ese archivo, los rangos **deben expandirse por ID**, no agruparse. Aun así, la estrategia de declaración debe ser la siguiente: `RTF-16..22` implementados; `RTF-23..25` implementados; `RTF-14..15` implementados; `RTF-13` parcial porque se trabajará con adaptador/fixtures y contrato en vez de polling vivo; `RTF-28`, `RTF-31` y `RTF-32` implementados en el flujo cubierto; `RTF-26` y `RTF-27` parciales para el tramo `requested -> assigned`; y el resto fuera de alcance con justificación explícita de que no son necesarios para demostrar el corte vertical evaluado. Esa misma lógica debe repetirse para los NFR y CAT aplicables. fileciteturn0file2 fileciteturn0file3

`README.md`, por su parte, no debe ser solo una guía de instalación. Debe funcionar como **mapa de navegación del evaluador**. Su contenido mínimo recomendado es: propósito del proyecto; resumen del alcance implementado; arquitectura resumida y módulos; árbol del repositorio; prerequisitos; variables de ambiente con placeholders; comandos exactos para correr lint, unit, integración, performance y CI local; ubicación del `SCOPE.md`; ubicación de reportes generados; y una sección corta de “decisiones técnicas relevantes” que anticipe la sustentación. Eso último es importante porque la guía deja claro que cualquier integrante debe poder defender cualquier parte del código y que la debilidad en defensa reduce la nota aunque el entregable sea fuerte. fileciteturn0file3

La coherencia entre `README.md`, `SCOPE.md`, código, pruebas y CI debe ser literal. Si `SCOPE.md` dice que se implementó `RTF-22`, el evaluador debe poder encontrar `dispatch_decisions`, eventos analíticos y pruebas que demuestren aceptación/rechazo de la sugerencia. Si dice que `RTF-26` es parcial, el código no puede fingir tener el ciclo completo de viaje. Si existe una desviación respecto del DD-01 o DD-02 — por ejemplo, usar un `FlagProvider` local en vez de una integración viva con Unleash, o un adaptador determinístico para distancias en vez de credenciales reales — esa desviación no penaliza por sí misma, siempre que quede documentada y el contrato de arquitectura se mantenga. fileciteturn0file3 fileciteturn0file1 fileciteturn0file0

Si el repositorio implementa exactamente este SDD, con el alcance declarado tal como aquí se define, tendrá cubierto el **100 % de lo exigible por la guía para el entregable técnico dentro del alcance elegido**: código defendible, pruebas útiles, CI con gates reales y coherencia con los documentos contractuales. La única variable externa que seguirá abierta será la sustentación oral, porque la guía la trata como multiplicador independiente de la calidad del repositorio. fileciteturn0file3