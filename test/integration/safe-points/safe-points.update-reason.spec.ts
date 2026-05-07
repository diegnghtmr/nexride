/**
 * Safe Points Update — reason vs auditReason Integration Tests
 *
 * Strict TDD: written BEFORE the implementation (RED phase).
 * Verifies the F4 hard-break: PATCH endpoint must accept both
 * `reason` (catalog — optional) and `auditReason` (audit — mandatory).
 *
 * T-F4-10: PATCH with only `reason` (no auditReason) → 400
 * T-F4-11: PATCH with both `reason` + `auditReason` → 200, catalog persisted
 * T-F4-12: Audit row `reason` equals `auditReason`, NOT `reason`
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

describe('SafePoints PATCH — reason vs auditReason (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let dataSource: DataSource;

  const supervisorHeaders = {
    'x-test-rider-id': 'supervisor-update-1',
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

  describe('PATCH /safe-points/:id — auditReason field enforcement', () => {
    it('T-F4-10: PATCH with only reason (no auditReason) returns 400', async () => {
      // Seed a safe-point first
      const createRes = await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send({
          name: 'Punto Seguro',
          zoneId: 'zone-f4-01',
          reason: 'Alta iluminación',
          safetyScore: 0.8,
          location: { lat: 4.65, lng: -74.05 },
        })
        .expect(201);

      const id = createRes.body.id as string;

      // PATCH with only reason — missing auditReason → must return 400
      const patchRes = await request(app.getHttpServer())
        .patch(`/safe-points/${id}`)
        .set(supervisorHeaders)
        .send({ reason: 'new security justification' })
        .expect(400);

      expect(patchRes.body).toBeDefined();
    });

    it('T-F4-11: PATCH with both reason + auditReason returns 200 and persists catalog reason', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send({
          name: 'Punto Seguro',
          zoneId: 'zone-f4-02',
          reason: 'Alta iluminación',
          safetyScore: 0.8,
          location: { lat: 4.65, lng: -74.05 },
        })
        .expect(201);

      const id = createRes.body.id as string;

      const patchRes = await request(app.getHttpServer())
        .patch(`/safe-points/${id}`)
        .set(supervisorHeaders)
        .send({
          reason: 'new security justification',
          auditReason: 'corrected typo per regulator request',
        })
        .expect(200);

      // Response body `reason` must reflect the new catalog value
      expect(patchRes.body.reason).toBe('new security justification');
    });

    it('T-F4-12: audit row reason equals auditReason, not the catalog reason', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send({
          name: 'Punto Seguro',
          zoneId: 'zone-f4-03',
          reason: 'Alta iluminación',
          safetyScore: 0.8,
          location: { lat: 4.65, lng: -74.05 },
        })
        .expect(201);

      const id = createRes.body.id as string;

      await request(app.getHttpServer())
        .patch(`/safe-points/${id}`)
        .set(supervisorHeaders)
        .send({
          reason: 'new security justification',
          auditReason: 'corrected typo per regulator request',
        })
        .expect(200);

      // Query DB for UPDATE audit row
      const auditRows = await dataSource.query<{ action: string; reason: string }[]>(
        `SELECT action, reason FROM safe_point_audit WHERE safe_point_id = $1 AND action = 'UPDATE'`,
        [id],
      );

      expect(auditRows).toHaveLength(1);
      // Audit reason must be the auditReason, not the catalog reason
      expect(auditRows[0].reason).toBe('corrected typo per regulator request');
      expect(auditRows[0].reason).not.toBe('new security justification');
    });
  });
});
