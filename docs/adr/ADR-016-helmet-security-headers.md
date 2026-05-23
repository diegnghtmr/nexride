# ADR-016 — Helmet HTTP security headers via AppModule middleware

**Estado**: Aceptado · v0.1.22-mvp
**Fecha**: 2026-05-22
**Contexto**: judgment 22° iteración 1, Juez A finding F1 (CRITICAL) y Juez B finding A3 (LOW-MEDIUM).

## Contexto

NestJS sobre Express **no incluye headers HTTP de seguridad por default**. Hasta v0.1.21-mvp, `src/main.ts` arrancaba la app sin `helmet`, sin `enableCors`, y sin ningún hardening de capa HTTP. La rúbrica del PDF (criterio C4: "NFRs en código — Seguridad sin hardcoding") y OWASP Top 10 A05 (Security Misconfiguration) esperan headers anti-XSS / anti-clickjacking / HSTS en cualquier API expuesta. El apunte `apuntes_calidad_patrones_seguridad_actualizado_4.md` lista en su roadmap (línea 1877) "Bloques 7–9: Inyección · Auth · XSS" — el archivo entregado por el profesor termina en Bloque 7 (SQL Injection), pero el tema XSS/headers está enumerado en el roadmap como cobertura esperada.

Los jueces ciegos del judgment 22° flagearon esto como finding bloqueante para llegar a 5.0:
- Juez A F1 (CRITICAL): "Ausencia total de headers HTTP de seguridad. `grep -r helmet src/` → 0 resultados. El TRD §13.4 prescribe OWASP Top 10 review y los apuntes mencionan XSS/headers en su roadmap."
- Juez B A3 (LOW-MEDIUM): "Sin `helmet` ni hardening HTTP headers. `main.ts:1-40` no tiene `app.use(helmet())` ni `app.enableCors()` con política explícita."

## Decisión

1. **Instalar `helmet@^8.2.0`** como `dependencies`. Es una librería madura, mantenida por la comunidad Express, con menos de 100 KB minificada y sin transitive deps con vulnerabilidades conocidas.
2. **Aplicar `helmet()` vía `AppModule.configure()`** (no vía `app.use()` en `main.ts`). Razón: aplicar en el módulo garantiza que los headers están activos en BOTH:
   - El entrypoint `nest start` (producción local + Docker).
   - Los integration tests que usan `Test.createTestingModule(...).compile().createNestApplication()` — donde `main.ts` nunca se ejecuta. Aplicar via `app.use()` en `main.ts` dejaría a los tests sin la verificación.
3. **CSP (Content-Security-Policy) deshabilitado explícitamente** con `helmet({ contentSecurityPolicy: false })`. Justificación: el slice MVP expone solo una API JSON consumida por integraciones — no hay browser SPA con scripts inline. Habilitar CSP sin un cliente browser real produce headers irrelevantes que pueden romper futuros consumidores. Cuando el cliente browser aterrice post-MVP, CSP y CORS-allowlist se configurarán juntos en un único PR.
4. **CORS NO se habilita en este slice**. El slice consume requests desde integraciones server-to-server o de testing — sin browser cross-origin no hay preflight CORS real. Habilitar `app.enableCors()` con `origin: '*'` sería el antipatrón clásico que los apuntes advierten. Habilitarlo con allowlist sin saber el origen del cliente futuro es prematuro. **CORS queda explícitamente diferido a post-MVP** junto con CSP — un único PR cuando el cliente browser exista.

## Headers que helmet pone en cada respuesta

Verificable en `test/integration/observability/security-headers.spec.ts`:

| Header                             | Valor por default                                |
| ---------------------------------- | ------------------------------------------------ |
| `X-Content-Type-Options`           | `nosniff`                                        |
| `X-Frame-Options`                  | `SAMEORIGIN`                                     |
| `Strict-Transport-Security`        | `max-age=15552000; includeSubDomains`            |
| `Referrer-Policy`                  | `no-referrer`                                    |
| `X-DNS-Prefetch-Control`           | `off`                                            |
| `X-Download-Options`               | `noopen`                                         |
| `X-Permitted-Cross-Domain-Policies`| `none`                                           |
| `Cross-Origin-Embedder-Policy`     | `require-corp`                                   |
| `Cross-Origin-Opener-Policy`       | `same-origin`                                    |
| `Cross-Origin-Resource-Policy`     | `same-origin`                                    |
| `X-Powered-By`                     | **removido** (Express lo añade por default)      |

## Consecuencias

- OWASP A05 (Security Misconfiguration) mitigado para todos los endpoints registrados, sin código adicional por endpoint.
- Coverage observable del criterio C4 NFR de seguridad sube en la rúbrica.
- 6 nuevos integration tests en `test/integration/observability/security-headers.spec.ts` que aseveran cada header y la ausencia de `X-Powered-By` y CSP (CSP intencionalmente off).
- Mantenimiento: helmet es mantenido por Express ecosystem; las nuevas reglas que helmet añada en futuras versiones (e.g. Permissions-Policy) entrarán automáticamente vía `npm update helmet` sin cambio de código.
- Riesgo: `Strict-Transport-Security` con `max-age=15552000` (~180 días) es agresivo para staging. Si el deployment futuro a staging usa HTTP puro, los browsers van a forzar HTTPS. Solución cuando llegue: configurar helmet por entorno via `ConfigService` (no requerido en MVP porque no hay deployment todavía).

## Alternativas consideradas y descartadas

- **`app.use(helmet())` en `main.ts`**: deja los integration tests sin la verificación porque no ejecutan main.ts. Inferior a la opción elegida.
- **Helmet por controlador con `@UseInterceptors`**: lo aplicaría sólo a esos controladores y no a `/metrics` ni a Swagger UI. La opción de middleware global cubre todo.
- **Configurar headers manualmente con `app.use((req,res,next)=>{...})`**: re-implementar helmet en código casero es deuda inmediata; helmet ya está auditado por la comunidad.
- **CSP habilitado con default policy**: rompería el endpoint Swagger UI (`/api`) que carga scripts inline desde swagger-ui-express. Deshabilitarlo selectivamente para Swagger es complejidad innecesaria en MVP.

## Referencias

- `src/app.module.ts` `AppModule.configure()` — registro de helmet en module middleware
- `src/main.ts` — comentario que apunta a AppModule.configure para el wiring
- `test/integration/observability/security-headers.spec.ts` — 6 assertions verificando cada header
- `docs/security/owasp-top-10-review.md` — A05 referencia a este ADR como evidencia de control
- Apuntes profesor `apuntes_calidad_patrones_seguridad_actualizado_4.md` línea 1877 — roadmap "Bloques 7-9: Inyección · Auth · XSS" (el archivo entregado termina en Bloque 7; XSS/headers se infiere del roadmap)
- OWASP Top 10 (2021) A05 — Security Misconfiguration (fuente externa vinculante)
- TRD §13.4 — OWASP Top 10 review
- Judgment 22° dual-judge (Juez A F1 CRITICAL, Juez B A3)
