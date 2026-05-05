/**
 * Safe Points RBAC Integration Tests
 *
 * Verifies that the RBAC guard correctly restricts mutating operations
 * to supervisor/administrador roles only. Riders and unauthenticated
 * requests are rejected.
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

describe('SafePoints RBAC (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let dataSource: DataSource;
  let existingPointId: string;

  const supervisorHeaders = {
    'x-test-rider-id': 'supervisor-rbac-1',
    'x-test-rider-role': 'supervisor',
  };

  const administradorHeaders = {
    'x-test-rider-id': 'admin-rbac-1',
    'x-test-rider-role': 'administrador',
  };

  const riderHeaders = {
    'x-test-rider-id': 'rider-rbac-1',
    'x-test-rider-role': 'rider',
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

    // Seed a safe point for use in mutation tests
    const res = await request(app.getHttpServer())
      .post('/safe-points')
      .set(supervisorHeaders)
      .send({
        name: 'RBAC Test Point',
        zoneId: 'zone-rbac',
        reason: 'Para probar RBAC',
        safetyScore: 0.75,
        location: { lat: 4.65, lng: -74.05 },
      });
    existingPointId = res.body.id as string;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('supervisor can POST /safe-points', async () => {
    await request(app.getHttpServer())
      .post('/safe-points')
      .set(supervisorHeaders)
      .send({
        name: 'Supervisor Point',
        zoneId: 'zone-rbac-s',
        reason: 'Supervisor puede crear',
        safetyScore: 0.8,
        location: { lat: 4.651, lng: -74.051 },
      })
      .expect(201);
  });

  it('administrador can POST /safe-points', async () => {
    await request(app.getHttpServer())
      .post('/safe-points')
      .set(administradorHeaders)
      .send({
        name: 'Admin Point',
        zoneId: 'zone-rbac-a',
        reason: 'Admin puede crear',
        safetyScore: 0.8,
        location: { lat: 4.652, lng: -74.052 },
      })
      .expect(201);
  });

  it('rider cannot POST /safe-points — 403 RbacForbiddenError', async () => {
    const res = await request(app.getHttpServer())
      .post('/safe-points')
      .set(riderHeaders)
      .send({
        name: 'Rider Attempt',
        zoneId: 'zone-rbac-r',
        reason: 'Rider no puede',
        safetyScore: 0.5,
        location: { lat: 4.653, lng: -74.053 },
      })
      .expect(403);

    expect(res.body.code).toBe('RBAC_FORBIDDEN');
  });

  it('rider cannot PATCH /safe-points/:id — 403 RbacForbiddenError', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/safe-points/${existingPointId}`)
      .set(riderHeaders)
      .send({ reason: 'intento rider' })
      .expect(403);

    expect(res.body.code).toBe('RBAC_FORBIDDEN');
  });

  it('rider cannot DELETE /safe-points/:id — 403 RbacForbiddenError', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/safe-points/${existingPointId}`)
      .set(riderHeaders)
      .query({ reason: 'intento borrado' })
      .expect(403);

    expect(res.body.code).toBe('RBAC_FORBIDDEN');
  });

  it('authenticated rider can GET /safe-points/within (read is allowed)', async () => {
    await request(app.getHttpServer())
      .get('/safe-points/within')
      .set(riderHeaders)
      .query({ lat: 4.65, lng: -74.05, radiusM: 200 })
      .expect(200);
  });
});
