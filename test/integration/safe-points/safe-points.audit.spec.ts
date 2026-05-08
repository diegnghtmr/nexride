/**
 * Safe Points Audit Integration Tests
 *
 * Focused on audit trail completeness: every mutating operation
 * must produce exactly one audit row with the correct action.
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

describe('SafePoints Audit Trail (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let dataSource: DataSource;

  const supervisorHeaders = {
    'x-test-rider-id': 'supervisor-audit-1',
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
          load: [
            () => ({
              TEST_CONTEXT_GUARD_ENABLED: 'true',
              NODE_ENV: 'test',
            }),
          ],
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
      providers: [
        {
          provide: APP_FILTER,
          useClass: DomainExceptionFilter,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    process.env['NODE_ENV'] = 'test';

    await app.init();
    dataSource = module.get<DataSource>(getDataSourceToken());

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

  async function createSafePoint(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/safe-points')
      .set(supervisorHeaders)
      .send({
        name: 'Audit Test Point',
        zoneId: 'zone-audit',
        reason: 'Razon de creacion',
        safetyScore: 0.7,
        location: { lat: 4.65, lng: -74.05 },
      })
      .expect(201);
    return res.body.id as string;
  }

  it('CREATE action audit row has correct fields', async () => {
    const id = await createSafePoint();

    const rows = await dataSource.query<{ action: string; reason: string; changed_by: string; snapshot: unknown }[]>(
      `SELECT action, reason, changed_by, snapshot FROM safe_point_audit WHERE safe_point_id = $1`,
      [id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('CREATE');
    expect(rows[0].reason).toBe('Razon de creacion');
    expect(rows[0].changed_by).toBeDefined();
    expect(rows[0].snapshot).toBeDefined();
  });

  it('UPDATE action audit row captured correctly', async () => {
    const id = await createSafePoint();

    await request(app.getHttpServer())
      .patch(`/safe-points/${id}`)
      .set(supervisorHeaders)
      .send({ safetyScore: 0.9, auditReason: 'Mejora de puntuacion' })
      .expect(200);

    const rows = await dataSource.query<{ action: string; reason: string }[]>(
      `SELECT action, reason FROM safe_point_audit WHERE safe_point_id = $1 ORDER BY changed_at`,
      [id],
    );

    expect(rows).toHaveLength(2);
    expect(rows[1].action).toBe('UPDATE');
    expect(rows[1].reason).toBe('Mejora de puntuacion');
  });

  it('DELETE action audit row captured with reason', async () => {
    const id = await createSafePoint();

    await request(app.getHttpServer())
      .delete(`/safe-points/${id}`)
      .set(supervisorHeaders)
      .query({ reason: 'Punto obsoleto' })
      .expect(204);

    const rows = await dataSource.query<{ action: string; reason: string }[]>(
      `SELECT action, reason FROM safe_point_audit WHERE safe_point_id = $1 AND action = 'DELETE'`,
      [id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe('Punto obsoleto');
  });

  // T-F5-11-INTEGRATION — ACTIVATE audit row (F5 — v0.1.12-mvp)
  it('T-F5-11: PATCH /:id/activate writes audit row with action=ACTIVATE', async () => {
    // Start with an inactive safe point by creating then deactivating
    const id = await createSafePoint();
    await request(app.getHttpServer())
      .patch(`/safe-points/${id}/deactivate`)
      .set(supervisorHeaders)
      .send({ reason: 'Desactivación previa para test' })
      .expect(200);

    // Activate it
    await request(app.getHttpServer())
      .patch(`/safe-points/${id}/activate`)
      .set(supervisorHeaders)
      .send({ reason: 'Reparación completada — reactivado' })
      .expect(200);

    // Históricamente la PATCH response body de NestJS omite campos por la serialización
    // (gap S1 documentado en v0.1.11-mvp). Asertamos contra DB que es la fuente de verdad.
    const statusRows = await dataSource.query<{ status: string }[]>(`SELECT status FROM safe_points WHERE id = $1`, [
      id,
    ]);
    expect(statusRows[0].status).toBe('active');

    const rows = await dataSource.query<{ action: string; reason: string; changed_by: string; snapshot: unknown }[]>(
      `SELECT action, reason, changed_by, snapshot FROM safe_point_audit WHERE safe_point_id = $1 AND action = 'ACTIVATE'`,
      [id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('ACTIVATE');
    expect(rows[0].reason).toBe('Reparación completada — reactivado');
    expect(rows[0].changed_by).toBeDefined();
    expect(rows[0].snapshot).toBeDefined();
  });

  it('T-F5-12: PATCH /:id/activate returns 400 when reason is empty', async () => {
    const id = await createSafePoint();

    await request(app.getHttpServer())
      .patch(`/safe-points/${id}/activate`)
      .set(supervisorHeaders)
      .send({ reason: '' })
      .expect(400);
  });

  it('T-F5-13: PATCH /:id/activate returns 404 for non-existent safe point', async () => {
    await request(app.getHttpServer())
      .patch(`/safe-points/00000000-0000-0000-0000-000000000000/activate`)
      .set(supervisorHeaders)
      .send({ reason: 'Test non-existent' })
      .expect(404);
  });
});
