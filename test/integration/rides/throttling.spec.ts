/**
 * Rate Limiting Integration Test — Two-Tier Throttling (T-004 · RED · F3/F6)
 *
 * Strict TDD: This file is the RED commit — written BEFORE the two-tier ThrottlerModule
 * config and ConfigurableThrottlerGuard.getTracker override are implemented.
 *
 * Verifies that the global ConfigurableThrottlerGuard enforces:
 *   - Per-user throttler: 100 req/60s per userId (trips on 101st same-user request)
 *   - Per-IP throttler: THROTTLER_TEST_LIMIT req/60s per IP across distinct users
 *     (default 1000 in production; overridden to 10 in test for speed)
 *   - Unauthenticated fallback: request without auth does NOT cause HTTP 500
 *
 * IMPORTANT: setup.ts sets THROTTLER_DISABLED=1 for all integration tests.
 * This test explicitly deletes that env var in beforeAll so the guard is active.
 * afterAll restores the env var.
 *
 * Uses real AppModule (Testcontainers Postgres+Redis), same pattern as rides.request.spec.ts.
 * ThrottleTestController is intentionally ABSENT — no dead code.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import IORedis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { ThrottlerStorage } from '@nestjs/throttler';

// Origin + destination for POST /rides/request calls (Bogotá coords within range)
const ORIGIN = { lat: 4.65, lng: -74.05 };
const DESTINATION = { lat: 4.7, lng: -74.06 };

describe('Two-Tier Throttling Integration (T-004)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let app: INestApplication;
  let dataSource: DataSource;
  let redisClient: IORedis;
  let throttlerStorage: ThrottlerStorage;

  let savedThrottlerDisabled: string | undefined;
  let savedThrottlerTestLimit: string | undefined;

  beforeAll(async () => {
    // Save and clear env vars so the throttler guard is ACTIVE for this suite.
    savedThrottlerDisabled = process.env['THROTTLER_DISABLED'];
    savedThrottlerTestLimit = process.env['THROTTLER_TEST_LIMIT'];

    delete process.env['THROTTLER_DISABLED'];
    // Clear THROTTLER_TEST_LIMIT — each scenario sets it per-test in beforeEach/it.
    delete process.env['THROTTLER_TEST_LIMIT'];
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    process.env['NODE_ENV'] = 'test';

    // Spin up containers in parallel
    [pgContainer, redisContainer] = await Promise.all([
      new PostgreSqlContainer('postgis/postgis:16-3.4')
        .withDatabase('nexride_test')
        .withUsername('postgres')
        .withPassword('test')
        .start(),
      new RedisContainer('redis:7-alpine').start(),
    ]);

    process.env['DATABASE_URL'] = pgContainer.getConnectionUri();
    process.env['REDIS_URL'] = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleRef.get<DataSource>(DataSource);
    throttlerStorage = moduleRef.get<ThrottlerStorage>(ThrottlerStorage);

    // External Redis client for fleet seeding
    redisClient = new IORedis(process.env['REDIS_URL']!);

    // Run migrations
    await dataSource.runMigrations();

    // Seed minimal fleet data so POST /rides/request can dispatch
    const freshTs = Date.now();
    await redisClient.geoadd('fleet:geo', -74.051, 4.651, 'VH-T01');
    await redisClient.hset('fleet:vehicles:VH-T01', {
      battery_pct: '80',
      eligible: '1',
      state: 'in_service',
      snapshot_at: new Date(freshTs).toISOString(),
      range_km: '120',
    });
  }, 240_000);

  afterAll(async () => {
    await redisClient?.quit();
    await app?.close();
    await pgContainer?.stop();
    await redisContainer?.stop();

    // Restore env vars
    if (savedThrottlerDisabled !== undefined) {
      process.env['THROTTLER_DISABLED'] = savedThrottlerDisabled;
    } else {
      delete process.env['THROTTLER_DISABLED'];
    }

    if (savedThrottlerTestLimit !== undefined) {
      process.env['THROTTLER_TEST_LIMIT'] = savedThrottlerTestLimit;
    } else {
      delete process.env['THROTTLER_TEST_LIMIT'];
    }
  });

  /**
   * Reset in-memory throttler counters and env overrides between scenarios to prevent bleed.
   * ThrottlerStorageService uses an internal Map (_storage); we clear it via
   * the public `storage` getter.
   */
  afterEach(() => {
    // Clear IP limit override so next scenario starts fresh
    delete process.env['THROTTLER_TEST_LIMIT'];

    const service = throttlerStorage as unknown as { _storage?: Map<string, unknown>; storage?: Map<string, unknown> };
    if (service._storage instanceof Map) {
      service._storage.clear();
    } else if (service.storage instanceof Map) {
      service.storage.clear();
    }
  });

  it('Scenario 1 — per-user throttler: 100 requests succeed, 101st returns 429', async () => {
    // IP throttler: production default (1000) — don't set THROTTLER_TEST_LIMIT so the
    // user throttler (limit 100) trips before the IP throttler (limit 1000).
    delete process.env['THROTTLER_TEST_LIMIT'];

    const server = app.getHttpServer();
    const riderId = 'throttle-user-u1';

    // Send 100 requests — all must succeed (2xx)
    for (let i = 0; i < 100; i++) {
      const res = await request(server)
        .post('/rides/request')
        .set('x-test-rider-id', riderId)
        .set('x-test-rider-role', 'rider')
        .send({ origin: ORIGIN, destination: DESTINATION });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
      // Should NOT be throttled yet
      expect(res.status).not.toBe(429);
    }

    // 101st request from same user must be throttled
    const limitedRes = await request(server)
      .post('/rides/request')
      .set('x-test-rider-id', riderId)
      .set('x-test-rider-role', 'rider')
      .send({ origin: ORIGIN, destination: DESTINATION });

    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body).toMatchObject(expect.objectContaining({ statusCode: 429 }));
  }, 120_000);

  it('Scenario 2 — per-IP throttler: THROTTLER_TEST_LIMIT requests succeed, (limit+1)th returns 429', async () => {
    // Scale down IP limit to 10 for test speed (1001 sequential requests would be too slow).
    // The ip throttler limit function reads THROTTLER_TEST_LIMIT lazily per request.
    process.env['THROTTLER_TEST_LIMIT'] = '10';

    const server = app.getHttpServer();
    // THROTTLER_TEST_LIMIT=10 → IP throttler limit is 10
    const ipLimit = parseInt(process.env['THROTTLER_TEST_LIMIT'] ?? '10', 10);

    // Send ipLimit requests each with a UNIQUE userId — different users, same loopback IP
    for (let i = 0; i < ipLimit; i++) {
      const uniqueRiderId = `throttle-ip-user-${i}-${Date.now()}`;
      const res = await request(server)
        .post('/rides/request')
        .set('x-test-rider-id', uniqueRiderId)
        .set('x-test-rider-role', 'rider')
        .send({ origin: ORIGIN, destination: DESTINATION });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
      expect(res.status).not.toBe(429);
    }

    // (limit+1)th request with yet another unique userId — IP bucket is full
    const overLimitRiderId = `throttle-ip-over-${Date.now()}`;
    const limitedRes = await request(server)
      .post('/rides/request')
      .set('x-test-rider-id', overLimitRiderId)
      .set('x-test-rider-role', 'rider')
      .send({ origin: ORIGIN, destination: DESTINATION });

    expect(limitedRes.status).toBe(429);
  }, 60_000);

  it('Scenario 3 — unauthenticated fallback: request without auth does NOT return 500', async () => {
    const server = app.getHttpServer();

    const res = await request(server).post('/rides/request').send({ origin: ORIGIN, destination: DESTINATION });

    // Must not be a server error (throttler must not throw on unauthenticated requests)
    expect(res.status).not.toBe(500);
    // Expected: 401 (auth guard fires first) or 403 (TestContextGuard) or 429 (IP throttler)
    expect([401, 403, 429]).toContain(res.status);
  }, 30_000);
});
