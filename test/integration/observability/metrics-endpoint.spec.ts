/**
 * Metrics Endpoint Integration Tests — Strict TDD RED phase
 *
 * Verifies that GET /metrics:
 *  - Returns 200 with Content-Type text/plain
 *  - Body contains at least one Prometheus HELP or TYPE line
 *  - Is NOT blocked by TestContextGuard (no credentials required)
 *
 * REQ-FIX-03, REQ-OBS-1..4 (F2 dispatch counters)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { DataSource } from 'typeorm';
import IORedis from 'ioredis';
import { register } from 'prom-client';
import { AppModule } from '../../../src/app.module';
import { DomainExceptionFilter } from '../../../src/common/filters/domain-exception.filter';
import { resetMetricsRegistry } from '../../../src/common/observability/metrics.registry';
import { getCounterValue } from '../../helpers/prometheus-parser';

const ORIGIN = { lat: 4.65, lng: -74.05 };
const DESTINATION = { lat: 4.7, lng: -74.06 };

describe('GET /metrics (integration)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let app: INestApplication;
  let dataSource: DataSource;
  let redisClient: IORedis;

  beforeAll(async () => {
    // prom-client global registry persists between Nest test bootstraps;
    // clear before module compile to avoid duplicate-metric errors. (ADR-4)
    register.clear();
    // Reset the module-level singleton so the fresh Registry is picked up. (F1/F2)
    resetMetricsRegistry();

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
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    process.env['NODE_ENV'] = 'test';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    dataSource = moduleRef.get<DataSource>(DataSource);
    await dataSource.runMigrations();

    redisClient = new IORedis(process.env['REDIS_URL']!);
  }, 180_000);

  afterAll(async () => {
    await redisClient.quit();
    await app.close();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  it('returns 200 with text/plain content-type', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
  });

  it('body contains at least one Prometheus HELP or TYPE line', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');

    expect(res.text).toMatch(/^# (HELP|TYPE)/m);
  });

  it('is accessible without authentication credentials (guard exemption)', async () => {
    // TestContextGuard is per-controller; /metrics must NOT require auth headers
    const res = await request(app.getHttpServer()).get('/metrics');

    expect(res.status).toBe(200);
  });

  // REQ-OBS-1..4 (F2) — dispatch metric counters increment after evaluate + confirm
  describe('F2 dispatch metrics — counters after evaluate+confirm flow', () => {
    beforeEach(async () => {
      // Seed fleet for requests
      const freshTs = new Date().toISOString();
      await redisClient.geoadd('fleet:geo', -74.051, 4.651, 'VH-200');
      await redisClient.hset('fleet:vehicles:VH-200', {
        battery_pct: '80',
        eligible: '1',
        state: 'in_service',
        snapshot_at: freshTs,
        range_km: '120',
      });

      await dataSource.query(`DELETE FROM trips`);
      await dataSource.query(`DELETE FROM dispatch_decisions`);
      await dataSource.query(`DELETE FROM analytics_events`);
    });

    afterEach(async () => {
      await redisClient.del('fleet:geo');
      await redisClient.del('fleet:vehicles:VH-200');
    });

    it('dispatch_evaluate_total counter value is greater than 0 after an evaluate call', async () => {
      await request(app.getHttpServer())
        .post('/rides/request')
        .set('x-test-rider-id', 'rider-metrics-test')
        .set('x-test-rider-role', 'rider')
        .send({ origin: ORIGIN, destination: DESTINATION })
        .expect(201);

      const metricsRes = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(getCounterValue(metricsRes.text, 'dispatch_evaluate_total', { outcome: 'success' })).toBeGreaterThan(0);
    });

    it('dispatch_evaluate_duration_ms_count is greater than 0 after an evaluate call', async () => {
      await request(app.getHttpServer())
        .post('/rides/request')
        .set('x-test-rider-id', 'rider-metrics-test')
        .set('x-test-rider-role', 'rider')
        .send({ origin: ORIGIN, destination: DESTINATION })
        .expect(201);

      const metricsRes = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(getCounterValue(metricsRes.text, 'dispatch_evaluate_duration_ms_count')).toBeGreaterThan(0);
    });

    it('dispatch_confirm_total counter value is greater than 0 after a confirm call', async () => {
      const evalRes = await request(app.getHttpServer())
        .post('/rides/request')
        .set('x-test-rider-id', 'rider-metrics-test')
        .set('x-test-rider-role', 'rider')
        .send({ origin: ORIGIN, destination: DESTINATION })
        .expect(201);

      await request(app.getHttpServer())
        .post('/rides/confirm')
        .set('x-test-rider-id', 'rider-metrics-test')
        .set('x-test-rider-role', 'rider')
        .send({ requestId: evalRes.body.requestId, choice: 'original' })
        .expect(201);

      const metricsRes = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(getCounterValue(metricsRes.text, 'dispatch_confirm_total', { outcome: 'assigned' })).toBeGreaterThan(0);
    });

    it('dispatch_candidates_count_count is greater than 0 after an evaluate call', async () => {
      await request(app.getHttpServer())
        .post('/rides/request')
        .set('x-test-rider-id', 'rider-metrics-test')
        .set('x-test-rider-role', 'rider')
        .send({ origin: ORIGIN, destination: DESTINATION })
        .expect(201);

      const metricsRes = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(getCounterValue(metricsRes.text, 'dispatch_candidates_count_count')).toBeGreaterThan(0);
    });

    // F3: DD-02 §14 phase histograms registered and observed after evaluate
    it('dispatch_phase_candidature_duration_ms_bucket appears in /metrics after evaluate (F3)', async () => {
      await request(app.getHttpServer())
        .post('/rides/request')
        .set('x-test-rider-id', 'rider-metrics-f3')
        .set('x-test-rider-role', 'rider')
        .send({ origin: ORIGIN, destination: DESTINATION })
        .expect(201);

      const metricsRes = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(metricsRes.text).toMatch(/dispatch_phase_candidature_duration_ms_bucket/);
      expect(metricsRes.text).toMatch(/dispatch_phase_filter_duration_ms_bucket/);
      expect(metricsRes.text).toMatch(/dispatch_phase_scoring_duration_ms_bucket/);
    });
  });
});
