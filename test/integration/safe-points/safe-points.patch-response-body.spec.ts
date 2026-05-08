/**
 * Judgment 20° F7 — pin-points the response body contract of the 3 PATCH
 * endpoints on /safe-points/:id.
 *
 * History: a "PATCH response body serialization gap" was carried in the
 * backlog as `S1` from v0.1.10-mvp through v0.1.20-mvp without ADR or
 * concrete reproduction. This spec validates that the contract IS in fact
 * correct and converts the phantom backlog item into a regression gate.
 *
 * If anyone in the future regresses serialization (e.g., adds an interceptor
 * that strips a field, changes the entity → DTO mapping, or returns void
 * from the service), THIS test breaks first.
 *
 * Closure: see ADR-013-patch-response-body-resolution.md.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { APP_FILTER } from '@nestjs/core';
import { DomainExceptionFilter } from '../../../src/common/filters/domain-exception.filter';
import { SafePointsModule } from '../../../src/safe-points/safe-points.module';
import { SafePointEntity } from '../../../src/safe-points/infrastructure/safe-point.entity';
import { SafePointAuditEntity } from '../../../src/safe-points/infrastructure/safe-point-audit.entity';

describe('SafePoints PATCH response body contract (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let dataSource: DataSource;

  const supervisorHeaders = {
    'x-test-rider-id': 'supervisor-user-1',
    'x-test-rider-role': 'supervisor',
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
      .withDatabase('nexride_test')
      .withUsername('postgres')
      .withPassword('test')
      .start();

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ TEST_CONTEXT_GUARD_ENABLED: 'true', NODE_ENV: 'test' })],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [SafePointEntity, SafePointAuditEntity],
          synchronize: false,
          logging: false,
        }),
        SafePointsModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    process.env['NODE_ENV'] = 'test';

    await app.init();

    dataSource = module.get<DataSource>(getDataSourceToken());

    // Inline DDL — same pattern as safe-points.crud.spec.ts
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS safe_points (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        zone_id VARCHAR(60) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        location geography(Point,4326) NOT NULL,
        safety_score NUMERIC(4,3) NOT NULL CHECK (safety_score BETWEEN 0 AND 1),
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by TEXT,
        updated_by TEXT
      )
    `);
    await dataSource.query(`CREATE INDEX IF NOT EXISTS safe_points_location_gix ON safe_points USING GIST (location)`);
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS safe_point_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        safe_point_id UUID,
        action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE','UPDATE','DEACTIVATE','ACTIVATE','DELETE')),
        reason VARCHAR(255) NOT NULL,
        changed_by TEXT NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        snapshot JSONB
      )
    `);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE safe_point_audit CASCADE');
    await dataSource.query('TRUNCATE TABLE safe_points CASCADE');
  });

  async function createPoint(name = 'Patch-Body-Test'): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/safe-points')
      .set(supervisorHeaders)
      .send({
        name,
        zoneId: 'zone-patch-body',
        reason: 'baseline',
        safetyScore: 0.5,
        location: { lat: 4.66, lng: -74.06 },
      })
      .expect(201);
    return res.body.id as string;
  }

  function assertSafePointShape(body: Record<string, unknown>): void {
    expect(body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        zoneId: expect.any(String),
        reason: expect.any(String),
        safetyScore: expect.any(Number),
        status: expect.stringMatching(/^(active|inactive)$/),
        createdAt: expect.any(String), // ISO 8601 from JSON serialization
        updatedAt: expect.any(String),
        location: expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number),
        }),
      }),
    );
  }

  it('PATCH /:id returns the full updated SafePoint in the response body', async () => {
    const id = await createPoint();
    const res = await request(app.getHttpServer())
      .patch(`/safe-points/${id}`)
      .set(supervisorHeaders)
      .send({ name: 'Patched Name', auditReason: 'rename' })
      .expect(200);

    assertSafePointShape(res.body);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe('Patched Name');
  });

  it('PATCH /:id/activate returns the activated SafePoint with status="active"', async () => {
    const id = await createPoint('Activate-Body-Test');
    const res = await request(app.getHttpServer())
      .patch(`/safe-points/${id}/activate`)
      .set(supervisorHeaders)
      .send({ reason: 'reactivating after maintenance' })
      .expect(200);

    assertSafePointShape(res.body);
    expect(res.body.id).toBe(id);
    expect(res.body.status).toBe('active');
  });

  it('PATCH /:id/deactivate returns the deactivated SafePoint with status="inactive"', async () => {
    const id = await createPoint('Deactivate-Body-Test');
    const res = await request(app.getHttpServer())
      .patch(`/safe-points/${id}/deactivate`)
      .set(supervisorHeaders)
      .send({ reason: 'closing for renovation' })
      .expect(200);

    assertSafePointShape(res.body);
    expect(res.body.id).toBe(id);
    expect(res.body.status).toBe('inactive');
  });
});
