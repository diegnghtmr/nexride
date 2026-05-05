# NexRide MVP — Vertical Slice Backend

> TODO — fill complete content in Phase 5

## Propósito

NexRide MVP implementa el dominio de despacho de viajes con sugerencia de puntos seguros de recogida. Este repositorio contiene el *vertical slice* completo: evaluación de despacho, confirmación, gestión de puntos seguros, métricas y trazabilidad.

Ver [`SCOPE.md`](./SCOPE.md) para la matriz de requisitos y cobertura detallada.

## Alcance resumido

| Módulo | Estado |
|---|---|
| Evaluación de despacho (`/rides/request`) | TODO — Phase 5 |
| Confirmación de viaje (`/rides/confirm`) | TODO — Phase 5 |
| Gestión de puntos seguros (`/safe-points`) | TODO — Phase 5 |
| Observabilidad (logs + métricas) | TODO — Phase 5 |

Ver [`SCOPE.md`](./SCOPE.md) para el detalle completo por ID de requisito (RTF/NFR/CT).

## Arquitectura

> TODO — completar en Phase 5

El sistema sigue arquitectura hexagonal con separación estricta de dominio (ver CT-05/CT-06 en `.dependency-cruiser.cjs`):

```
┌────────────────────────────────────────────────┐
│  rider/ (controller)                           │
│    ↓ via DispatchFacade                        │
│  dispatch/ (domain + application)              │
│    ↓ via interfaces (common/interfaces/*)      │
│  fleet/ · safe-points/ · trip/ · analytics/   │
└────────────────────────────────────────────────┘
```

Ver ADRs en sección "Decisiones técnicas relevantes".

## Árbol de directorios

> TODO — completar en Phase 5 (árbol generado automáticamente)

## Prerequisitos

- Node.js 20+
- Docker y Docker Compose
- npm 10+

## Variables de ambiente

Copiar `.env.example` a `.env` y ajustar valores locales:

```bash
cp .env.example .env
```

Ver `.env.example` para la lista completa de variables con valores por defecto.

## Comandos

```bash
# Desarrollo
npm run dev                 # Start with watch mode

# Calidad
npm run lint                # ESLint
npm run lint:fix            # ESLint + autofix
npm run format              # Prettier write
npm run format:check        # Prettier check
npm run typecheck           # TypeScript no-emit

# Tests
npm run test:unit           # Jest unit tests
npm run test:integration    # Jest integration (Testcontainers)
npm run test:performance    # k6 performance smoke
npm run test:cov            # Unit tests + coverage report

# Arquitectura
npm run arch:check          # dependency-cruiser violations

# Build y OpenAPI
npm run build               # nest build
npm run openapi:generate    # Generate dist/openapi.json

# Seguridad
npm run audit               # npm audit --audit-level=high
npm run gitleaks            # gitleaks secrets scan

# CI completo local
npm run ci:local            # lint + typecheck + arch + cov + integration + audit
```

## Guía de evaluación

> TODO — completar en Phase 5 (tabla: ID → archivo de código → archivo de test)

## Decisiones técnicas relevantes

> TODO — completar en Phase 5

Cinco ADRs documentados en el diseño técnico:

1. **ADR-001** — `IDistanceProvider`: Haversine + Redis cache + fault injection (stub para NFR-09)
2. **ADR-002** — `IFlagProvider`: `LocalFlagProvider` basado en `ConfigService` (sin Unleash)
3. **ADR-003** — `TestContextGuard` en lugar de JWT/OTP completo (headers de test, solo non-production)
4. **ADR-004** — k6 CI threshold leniente (p99 < 1500ms) vs target producción (1200ms)
5. **ADR-005** — `EventEmitter2` in-process vs Kafka (monolito MVP, ADR-005)

## Limitaciones conocidas

> TODO — completar en Phase 5
