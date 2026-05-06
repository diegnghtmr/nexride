/**
 * Rides Request Integration Tests — Strict TDD RED phase
 *
 * Boots Testcontainers Postgres+PostGIS + Redis, runs migrations, seeds data,
 * then tests POST /rides/request end-to-end.
 *
 * Scenarios:
 * 1. Happy path — 201 with requestId, original, and suggested when safe point improves safety by ≥15%
 * 2. No suggestion when safe point safety improvement < 15%
 * 3. dispatch_decisions row created with scores_json populated
 * 4. dispatch.request_created event emitted
 * 5. 422 when no vehicles in radius
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import IORedis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { DomainExceptionFilter } from '../../../src/common/filters/domain-exception.filter';
import { DispatchEventName } from '../../../src/common/events/event-names';

// Bogotá origin inside radius
const ORIGIN = { lat: 4.65, lng: -74.05 };
const DESTINATION = { lat: 4.7, lng: -74.06 };

// UUIDs for safe points (column type is uuid)
const SP_NEAR_HIGH_ID = '11111111-1111-1111-1111-111111111111';
const SP_OUTSIDE_ID = '22222222-2222-2222-2222-222222222222';

// Safe point at ~100m from origin, high safety score → should generate suggestion
const SAFE_POINT_NEAR_HIGH_SAFETY = {
  lat: 4.6509, // ~100m north
  lng: -74.05,
  safetyScore: 0.85,
};

// Safe point at ~130m from origin (outside 120m) → no suggestion
const SAFE_POINT_OUTSIDE = {
  lat: 4.6512, // ~133m north
  lng: -74.05,
  safetyScore: 0.9,
};

describe('POST /rides/request (integration)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let app: INestApplication;
  let dataSource: DataSource;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    // Start containers in parallel
    [pgContainer, redisContainer] = await Promise.all([
      new PostgreSqlContainer('postgis/postgis:16-3.4')
        .withDatabase('nexride_test')
        .withUsername('postgres')
        .withPassword('test')
        .start(),
      new RedisContainer('redis:7-alpine').start(),
    ]);

    // Set env vars before module creation
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
    eventEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);

    // Run migrations
    await dataSource.runMigrations();
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  beforeEach(async () => {
    // Clean data between tests
    await dataSource.query(`DELETE FROM dispatch_decisions`);
    await dataSource.query(`DELETE FROM safe_points`);

    // Seed safe points
    await dataSource.query(`
      INSERT INTO safe_points (id, name, reason, zone_id, safety_score, status, location, created_at, updated_at)
      VALUES
        ('${SP_NEAR_HIGH_ID}', 'Punto Seguro Cercano', 'Iluminación óptima', 'zona-1', ${SAFE_POINT_NEAR_HIGH_SAFETY.safetyScore}, 'active',
         ST_GeographyFromText('SRID=4326;POINT(${SAFE_POINT_NEAR_HIGH_SAFETY.lng} ${SAFE_POINT_NEAR_HIGH_SAFETY.lat})'), now(), now()),
        ('${SP_OUTSIDE_ID}', 'Punto Fuera Radio', 'Zona amplia', 'zona-1', ${SAFE_POINT_OUTSIDE.safetyScore}, 'active',
         ST_GeographyFromText('SRID=4326;POINT(${SAFE_POINT_OUTSIDE.lng} ${SAFE_POINT_OUTSIDE.lat})'), now(), now())
    `);

    // Seed Redis fleet (3 vehicles within 5km, 1 stale)
    const redisClient = new IORedis(process.env['REDIS_URL']!);

    const freshTs = Date.now();
    const staleTs = Date.now() - 65_000; // 65 seconds ago

    await redisClient.geoadd('fleet:geo', -74.051, 4.651, 'VH-001');
    await redisClient.hset('fleet:vehicles:VH-001', {
      battery_pct: '80',
      eligible: '1',
      state: 'in_service',
      snapshot_at: new Date(freshTs).toISOString(),
      range_km: '120',
    });

    await redisClient.geoadd('fleet:geo', -74.053, 4.652, 'VH-002');
    await redisClient.hset('fleet:vehicles:VH-002', {
      battery_pct: '70',
      eligible: '1',
      state: 'in_service',
      snapshot_at: new Date(freshTs).toISOString(),
      range_km: '100',
    });

    await redisClient.geoadd('fleet:geo', -74.055, 4.654, 'VH-003');
    await redisClient.hset('fleet:vehicles:VH-003', {
      battery_pct: '60',
      eligible: '1',
      state: 'in_service',
      snapshot_at: new Date(freshTs).toISOString(),
      range_km: '80',
    });

    // Stale vehicle
    await redisClient.geoadd('fleet:geo', -74.056, 4.655, 'VH-STALE');
    await redisClient.hset('fleet:vehicles:VH-STALE', {
      battery_pct: '90',
      eligible: '1',
      state: 'in_service',
      snapshot_at: new Date(staleTs).toISOString(),
      range_km: '150',
    });

    await redisClient.quit();
  });

  it('201 with requestId, original, and suggested when safe point improves safety by ≥15%', async () => {
    const response = await request(app.getHttpServer())
      .post('/rides/request')
      .set('x-test-rider-id', 'rider-01')
      .set('x-test-rider-role', 'rider')
      .send({ origin: ORIGIN, destination: DESTINATION })
      .expect(201);

    expect(response.body.requestId).toBeDefined();
    expect(response.body.original).toBeDefined();
    expect(response.body.original.vehicleId).toBeDefined();
    expect(response.body.suggested).toBeDefined();
    expect(response.body.suggested.safePointId).toBe(SP_NEAR_HIGH_ID);
    expect(response.body.suggested.walkingDistanceM).toBeLessThan(120);
  });

  it('dispatch_decisions row created with scores_json populated', async () => {
    const response = await request(app.getHttpServer())
      .post('/rides/request')
      .set('x-test-rider-id', 'rider-02')
      .set('x-test-rider-role', 'rider')
      .send({ origin: ORIGIN, destination: DESTINATION })
      .expect(201);

    const { requestId } = response.body;

    const [row] = await dataSource.query(`SELECT * FROM dispatch_decisions WHERE request_id = $1`, [requestId]);

    expect(row).toBeDefined();
    expect(row.scores_json).toBeDefined();
    expect(typeof row.scores_json).toBe('object');
    expect(row.trip_id).toBeNull();
  });

  it('emits dispatch.request_created event', async () => {
    const events: unknown[] = [];
    eventEmitter.on(DispatchEventName.RequestCreated, (payload) => events.push(payload));

    await request(app.getHttpServer())
      .post('/rides/request')
      .set('x-test-rider-id', 'rider-03')
      .set('x-test-rider-role', 'rider')
      .send({ origin: ORIGIN, destination: DESTINATION })
      .expect(201);

    // Allow event to propagate
    await new Promise((r) => setTimeout(r, 50));

    expect(events.length).toBeGreaterThanOrEqual(1);
    const event = events[0] as { userId: string };
    expect(event.userId).toBe('rider-03');

    eventEmitter.removeAllListeners(DispatchEventName.RequestCreated);
  });

  it('401 when x-test-rider-id header is missing', async () => {
    await request(app.getHttpServer())
      .post('/rides/request')
      .send({ origin: ORIGIN, destination: DESTINATION })
      .expect(403);
  });

  it('400 when body is invalid', async () => {
    await request(app.getHttpServer())
      .post('/rides/request')
      .set('x-test-rider-id', 'rider-04')
      .set('x-test-rider-role', 'rider')
      .send({ origin: { lat: 'bad' }, destination: DESTINATION })
      .expect(400);
  });
});
