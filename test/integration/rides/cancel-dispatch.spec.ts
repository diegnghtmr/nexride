/**
 * Integration test — dispatch.cancelled event scaffolding (F2 — v0.1.12-mvp)
 *
 * T-F2-06-INTEGRATION-RED: fires dispatch.cancelled manually via EventEmitter2
 * and asserts that DispatchAnalyticsHandler.onCancelled persists a row in
 * analytics_events with event_name='dispatch.cancelled'.
 *
 * No production emit site is added (RTF-26 cancellation use-case is post-MVP).
 * The handler is wired and ready; the test proves the wiring end-to-end.
 *
 * Note: no dispatch_cancelled_total counter is tested here (ADR-v11-04:
 * metrics-naming deferral — count is derivable via SQL).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { AppModule } from '../../../src/app.module';
import { DomainExceptionFilter } from '../../../src/common/filters/domain-exception.filter';
import { DispatchEventName } from '../../../src/common/events/event-names';
import { CancelledPayload } from '../../../src/common/events/event-payloads';

describe('dispatch.cancelled event → analytics_events row (integration, F2)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let app: INestApplication;
  let dataSource: DataSource;
  let eventEmitter: EventEmitter2;

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
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM analytics_events`);
  });

  // Poll for eventual consistency — @OnEvent async handler + TypeORM commit
  // may complete after a single setImmediate tick under CI load.
  async function waitForAnalyticsRow(requestId: string, timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const rows = await dataSource.query<{ count: string }[]>(
        `SELECT count(*)::text AS count FROM analytics_events WHERE request_id = $1`,
        [requestId],
      );
      if (Number(rows[0].count) >= 1) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for analytics row for requestId=${requestId}`);
  }

  it('T-F2-06: emitting dispatch.cancelled persists analytics_events row with correct fields', async () => {
    const payload: CancelledPayload = {
      requestId: randomUUID(),
      riderId: randomUUID(),
      tripId: randomUUID(),
      reason: 'rider_cancelled',
      cancelledBy: 'rider',
      ts: new Date().toISOString(),
    };

    // Fire the event directly — no production emit site (RTF-26 post-MVP).
    eventEmitter.emit(DispatchEventName.Cancelled, payload);
    await waitForAnalyticsRow(payload.requestId);

    const rows = await dataSource.query<{ event_name: string; request_id: string; trip_id: string; user_id: string }[]>(
      `SELECT event_name, request_id, trip_id, user_id FROM analytics_events WHERE request_id = $1`,
      [payload.requestId],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].event_name).toBe('dispatch.cancelled');
    expect(rows[0].request_id).toBe(payload.requestId);
    expect(rows[0].trip_id).toBe(payload.tripId);
    expect(rows[0].user_id).toBe(payload.riderId);
  });

  it('T-F2-07: analytics row metadata contains reason and cancelledBy fields', async () => {
    const payload: CancelledPayload = {
      requestId: randomUUID(),
      riderId: randomUUID(),
      tripId: randomUUID(),
      reason: 'timeout',
      cancelledBy: 'system',
      ts: new Date().toISOString(),
    };

    eventEmitter.emit(DispatchEventName.Cancelled, payload);
    await waitForAnalyticsRow(payload.requestId);

    const rows = await dataSource.query<{ metadata: Record<string, unknown> }[]>(
      `SELECT metadata FROM analytics_events WHERE request_id = $1`,
      [payload.requestId],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toMatchObject({
      reason: 'timeout',
      cancelledBy: 'system',
    });
  });
});
