/**
 * Metrics Endpoint Integration Tests — Strict TDD RED phase
 *
 * Verifies that GET /metrics:
 *  - Returns 200 with Content-Type text/plain
 *  - Body contains at least one Prometheus HELP or TYPE line
 *  - Is NOT blocked by TestContextGuard (no credentials required)
 *
 * REQ-FIX-03
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { AppModule } from '../../../src/app.module';
import { DomainExceptionFilter } from '../../../src/common/filters/domain-exception.filter';

describe('GET /metrics (integration)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let app: INestApplication;

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
    process.env['NODE_ENV'] = 'test';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  }, 180_000);

  afterAll(async () => {
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
});
