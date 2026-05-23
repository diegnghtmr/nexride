/**
 * Security Headers Integration Test — OWASP A05 (Security Misconfiguration)
 *
 * Verifies that helmet middleware is registered via AppModule.configure()
 * and emits the canonical HTTP security headers on the /metrics endpoint
 * (any registered route would do; /metrics is the most lightweight one
 * because it does not require Testcontainers infrastructure to respond).
 *
 * Cross-references: OWASP Top 10 (2021) A05 (Security Misconfiguration), TRD §13.4
 * OWASP Top 10 review, docs/security/owasp-top-10-review.md A05, ADR-016. The apunte
 * `apuntes_calidad_patrones_seguridad_actualizado_4.md` (línea 1877) lista en su
 * roadmap "Bloques 7-9: Inyección · Auth · XSS" — el archivo entregado termina en
 * Bloque 7, pero el tema HTTP security headers se infiere del roadmap.
 *
 * Why an integration test instead of a unit test on main.ts:
 * - helmet() is installed via AppModule.configure() so it applies in BOTH
 *   `nest start` (production entrypoint) AND tests built with Test.createTestingModule().
 * - Verifying the headers on a real HTTP response — instead of inspecting
 *   the express middleware stack — guards against accidental removal of the
 *   `consumer.apply(helmet()).forRoutes(...)` call in app.module.ts.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { register } from 'prom-client';
import { AppModule } from '../../../src/app.module';
import { resetMetricsRegistry } from '../../../src/common/observability/metrics.registry';

describe('Security HTTP headers (helmet via AppModule.configure)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    register.clear();
    resetMetricsRegistry();
    // No external infra needed — /metrics responds without DB/Redis.
    process.env['NODE_ENV'] = 'test';
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    // Stub minimal env vars so AppModule wiring resolves; the underlying repos
    // are never invoked because we only call /metrics.
    process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/stub';
    process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it('sets X-Content-Type-Options: nosniff on every response', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options: SAMEORIGIN (default helmet policy)', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('sets Strict-Transport-Security with includeSubDomains', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['strict-transport-security']).toMatch(/includeSubDomains/);
  });

  it('sets Referrer-Policy: no-referrer', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('removes X-Powered-By to hide framework fingerprint', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does NOT set Content-Security-Policy (slice is JSON API, not browser SPA)', async () => {
    // CSP is intentionally disabled — see app.module.ts comment + ADR-016
    // It will be enabled together with CORS allowlist when a browser client lands.
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
