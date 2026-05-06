/**
 * Confirm Suggested Safe-Point Integration Tests — Strict TDD RED phase
 *
 * Verifies REQ-FIX-04:
 *  1. Suggested choice stores the safe-point coordinates (not origin)
 *  2. Origin choice stores origin coordinates (no regression)
 *  3. Null suggested coords → domain error 422 MISSING_SUGGESTED_COORDINATES
 *
 * These tests bypass the full request pipeline by directly seeding
 * dispatch_decisions rows so we can control suggestedLat/suggestedLng precisely.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { DomainExceptionFilter } from '../../../src/common/filters/domain-exception.filter';
import IORedis from 'ioredis';
import { randomUUID } from 'node:crypto';

const SAFE_POINT_LAT = 4.65;
const SAFE_POINT_LNG = -74.05;
const ORIGIN_LAT = 4.6;
const ORIGIN_LNG = -74.1;
const DEST_LAT = 4.7;
const DEST_LNG = -74.06;
const VEHICLE_ID = 'VH-SUGGESTED-01';
const RIDER_ID = 'rider-suggested-test';

describe('POST /rides/confirm — suggested safe-point coordinates (integration)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let app: INestApplication;
  let dataSource: DataSource;
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
    await dataSource.runMigrations();

    redisClient = new IORedis(process.env['REDIS_URL']!);
  }, 180_000);

  afterAll(async () => {
    await redisClient.quit();
    await app.close();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  async function seedFleetVehicle(vehicleId: string): Promise<void> {
    const ts = new Date().toISOString();
    await redisClient.geoadd('fleet:geo', ORIGIN_LNG, ORIGIN_LAT, vehicleId);
    await redisClient.hset(`fleet:vehicles:${vehicleId}`, {
      battery_pct: '80',
      eligible: '1',
      state: 'in_service',
      snapshot_at: ts,
      range_km: '120',
    });
  }

  async function cleanFleetVehicle(vehicleId: string): Promise<void> {
    await redisClient.zrem('fleet:geo', vehicleId);
    await redisClient.del(`fleet:vehicles:${vehicleId}`);
  }

  const FIXED_SAFE_POINT_ID = '44444444-4444-4444-4444-444444444444';

  async function ensureSafePoint(): Promise<void> {
    await dataSource.query(
      `INSERT INTO safe_points (id, name, reason, zone_id, safety_score, status, location, created_at, updated_at)
       VALUES ($1, 'Suggested Point', 'Testing', 'zona-1', 0.9, 'active',
         ST_GeographyFromText('SRID=4326;POINT(' || $2 || ' ' || $3 || ')'), now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [FIXED_SAFE_POINT_ID, SAFE_POINT_LNG, SAFE_POINT_LAT],
    );
  }

  async function seedDecisionWithSuggestedCoords(
    requestId: string,
    suggestedLat: number | null,
    suggestedLng: number | null,
  ): Promise<void> {
    const suggestedPointId = suggestedLat !== null ? FIXED_SAFE_POINT_ID : null;
    if (suggestedPointId) await ensureSafePoint();
    await dataSource.query(
      `INSERT INTO dispatch_decisions
         (request_id, rider_id, original_lat, original_lng, destination_lat, destination_lng,
          suggested_lat, suggested_lng, suggested_point_id,
          vehicle_id, scores_json, suggestion_status, pipeline_duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        requestId,
        RIDER_ID,
        ORIGIN_LAT,
        ORIGIN_LNG,
        DEST_LAT,
        DEST_LNG,
        suggestedLat,
        suggestedLng,
        suggestedPointId,
        VEHICLE_ID,
        JSON.stringify({ seeded: true }),
        suggestedLat !== null ? 'shown' : 'not_shown',
        100,
      ],
    );
  }

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM trips`);
    await dataSource.query(`DELETE FROM dispatch_decisions`);
    await dataSource.query(`DELETE FROM safe_points`);
    await seedFleetVehicle(VEHICLE_ID);
  });

  afterEach(async () => {
    await cleanFleetVehicle(VEHICLE_ID);
  });

  it('stores safe-point coordinates as pickup when choice=suggested', async () => {
    const requestId = randomUUID();
    await seedDecisionWithSuggestedCoords(requestId, SAFE_POINT_LAT, SAFE_POINT_LNG);

    const res = await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', RIDER_ID)
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'suggested' })
      .expect(201);

    expect(res.body.tripId).toBeDefined();
    expect(res.body.pickupType).toBe('suggested');

    const [tripRow] = await dataSource.query(`SELECT pickup_lat, pickup_lng FROM trips WHERE id = $1`, [
      res.body.tripId,
    ]);

    expect(Number(tripRow.pickup_lat)).toBeCloseTo(SAFE_POINT_LAT, 5);
    expect(Number(tripRow.pickup_lng)).toBeCloseTo(SAFE_POINT_LNG, 5);
    // pickup must NOT equal origin
    expect(Number(tripRow.pickup_lat)).not.toBeCloseTo(ORIGIN_LAT, 5);
  });

  it('stores origin coordinates as pickup when choice=original (no regression)', async () => {
    const requestId = randomUUID();
    await seedDecisionWithSuggestedCoords(requestId, SAFE_POINT_LAT, SAFE_POINT_LNG);

    const res = await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', RIDER_ID)
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'original' })
      .expect(201);

    const [tripRow] = await dataSource.query(`SELECT pickup_lat, pickup_lng FROM trips WHERE id = $1`, [
      res.body.tripId,
    ]);

    expect(Number(tripRow.pickup_lat)).toBeCloseTo(ORIGIN_LAT, 5);
    expect(Number(tripRow.pickup_lng)).toBeCloseTo(ORIGIN_LNG, 5);
  });

  it('returns 422 MISSING_SUGGESTED_COORDINATES when choice=suggested but coords are null', async () => {
    const requestId = randomUUID();
    await seedDecisionWithSuggestedCoords(requestId, null, null);

    const res = await request(app.getHttpServer())
      .post('/rides/confirm')
      .set('x-test-rider-id', RIDER_ID)
      .set('x-test-rider-role', 'rider')
      .send({ requestId, choice: 'suggested' })
      .expect(422);

    expect(res.body.code).toBe('MISSING_SUGGESTED_COORDINATES');
  });
});
