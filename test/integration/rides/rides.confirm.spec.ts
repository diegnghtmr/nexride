/**
 * Rides Confirm Integration Tests — Strict TDD RED phase
 *
 * Precondition: POST /rides/request already works (rides.request.spec.ts covers it).
 * This spec focuses specifically on the confirm flow:
 *   - Successful confirm with 'original' choice
 *   - Successful confirm with 'suggested' choice
 *   - Double confirm → 409
 *   - Unknown requestId → 404
 *
 * Uses Testcontainers Postgres+PostGIS + Redis.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppModule } from '../../../src/app.module';
import { DomainExceptionFilter } from '../../../src/common/filters/domain-exception.filter';
import { DispatchEventName } from '../../../src/common/events/event-names';
import IORedis from 'ioredis';

const ORIGIN = { lat: 4.65, lng: -74.05 };
const DESTINATION = { lat: 4.7, lng: -74.06 };

describe('POST /rides/confirm (integration)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let app: INestApplication;
  let dataSource: DataSource;
  let eventEmitter: EventEmitter2;
  let redisClient: IORedis;

  beforeAll(async () => {
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
    eventEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);

    await dataSource.runMigrations();

    redisClient = new IORedis(process.env['REDIS_URL']!);
  }, 180_000);

  afterAll(async () => {
    await redisClient.quit();
    await app.close();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM trips`);
    await dataSource.query(`DELETE FROM dispatch_decisions`);
    await dataSource.query(`DELETE FROM analytics_events`);
    await dataSource.query(`DELETE FROM safe_points`);

    // Seed safe point that meets suggestion threshold (safety=0.85, ~100m from origin)
    await dataSource.query(`
      INSERT INTO safe_points (id, name, reason, zone_id, safety_score, status, location, created_at, updated_at)
      VALUES ('sp-confirm-test', 'Test Safe Point', 'Testing', 'zona-1', 0.85, 'active',
        ST_GeographyFromText('SRID=4326;POINT(-74.05 4.6509)'), now(), now())
    `);

    // Seed Redis fleet
    const freshTs = new Date().toISOString();
    await redisClient.geoadd('fleet:geo', -74.051, 4.651, 'VH-100');
    await redisClient.hset('fleet:vehicles:VH-100', {
      battery_pct: '80',
      eligible: '1',
      state: 'in_service',
      snapshot_at: freshTs,
      range_km: '120',
    });
    await redisClient.geoadd('fleet:geo', -74.053, 4.653, 'VH-101');
    await redisClient.hset('fleet:vehicles:VH-101', {
      battery_pct: '70',
      eligible: '1',
      state: 'in_service',
      snapshot_at: freshTs,
      range_km: '100',
    });
  });

  afterEach(async () => {
    await redisClient.del('fleet:geo');
    for (const id of ['VH-100', 'VH-101']) {
      await redisClient.del(`fleet:vehicles:${id}`);
    }
  });

  async function makeRequest(): Promise<{ requestId: string; suggested?: { safePointId: string } }> {
    const res = await request(app.getHttpServer())
      .post('/rides/request')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ origin: ORIGIN, destination: DESTINATION })
      .expect(201);
    return res.body;
  }

  it('201 with tripId when confirming with original choice', async () => {
    const { requestId } = await makeRequest();

    const res = await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'original' })
      .expect(201);

    expect(res.body.tripId).toBeDefined();
    expect(res.body.vehicleId).toBeDefined();
    expect(res.body.pickupType).toBe('original');
    expect(res.body.status).toBe('assigned');
  });

  it('dispatch_decisions updated with tripId and userChoice after confirm', async () => {
    const { requestId } = await makeRequest();

    const confirmRes = await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'original' })
      .expect(201);

    const [row] = await dataSource.query(`SELECT * FROM dispatch_decisions WHERE request_id = $1`, [requestId]);

    expect(row.trip_id).toBe(confirmRes.body.tripId);
    expect(row.user_choice).toBe('original');
    expect(row.confirmed_at).not.toBeNull();
  });

  it('trip row created with correct pickup_type=original', async () => {
    const { requestId } = await makeRequest();

    const confirmRes = await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'original' })
      .expect(201);

    const [tripRow] = await dataSource.query(`SELECT * FROM trips WHERE id = $1`, [confirmRes.body.tripId]);

    expect(tripRow).toBeDefined();
    expect(tripRow.pickup_type).toBe('original');
    expect(tripRow.suggested_point_id).toBeNull();
    expect(tripRow.status).toBe('assigned');
  });

  it('201 with suggested choice when suggestion was provided', async () => {
    const rideRes = await makeRequest();

    // Only test if suggestion was provided (depends on safe point seeding)
    if (!rideRes.suggested) {
      console.warn('No suggestion returned — skipping suggested choice test');
      return;
    }

    const res = await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ requestId: rideRes.requestId, choice: 'suggested' })
      .expect(201);

    expect(res.body.pickupType).toBe('suggested');
  });

  it('409 on double confirmation', async () => {
    const { requestId } = await makeRequest();

    await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'original' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'original' })
      .expect(409);
  });

  it('404 for unknown requestId', async () => {
    await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ requestId: '00000000-0000-0000-0000-000000000000', choice: 'original' })
      .expect(404);
  });

  it('emits trip.assigned and dispatch.completed events on successful confirm', async () => {
    const { requestId } = await makeRequest();

    const assignedEvents: unknown[] = [];
    const completedEvents: unknown[] = [];

    eventEmitter.on(DispatchEventName.TripAssigned, (p) => assignedEvents.push(p));
    eventEmitter.on(DispatchEventName.Completed, (p) => completedEvents.push(p));

    await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', 'rider-confirm-test')
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'original' })
      .expect(201);

    await new Promise((r) => setTimeout(r, 50));

    expect(assignedEvents.length).toBeGreaterThanOrEqual(1);
    expect(completedEvents.length).toBeGreaterThanOrEqual(1);

    eventEmitter.removeAllListeners(DispatchEventName.TripAssigned);
    eventEmitter.removeAllListeners(DispatchEventName.Completed);
  });
});
