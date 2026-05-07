/**
 * Safe Points CRUD Integration Tests
 *
 * Uses Testcontainers (PostGIS 16-3.4) to boot a real PostgreSQL+PostGIS
 * database. A NestJS TestingModule is created with TypeORM pointing to the
 * container. Migrations are applied before the suite runs.
 *
 * Strict TDD: tests were written BEFORE the implementation (RED phase).
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

describe('SafePoints CRUD (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let dataSource: DataSource;

  const supervisorHeaders = {
    'x-test-rider-id': 'supervisor-user-1',
    'x-test-rider-role': 'supervisor',
  };

  const riderHeaders = {
    'x-test-rider-id': 'rider-user-1',
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

    // Enable TestContextGuard for this test run
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    process.env['NODE_ENV'] = 'test';

    await app.init();

    dataSource = module.get<DataSource>(getDataSourceToken());

    // Run schema migrations manually (DDL)
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
    // Clean data between tests
    await dataSource.query('TRUNCATE TABLE safe_point_audit CASCADE');
    await dataSource.query('TRUNCATE TABLE safe_points CASCADE');
  });

  describe('POST /safe-points', () => {
    it('Given authenticated supervisor, when POST with valid body and reason, then 201 + audit row created', async () => {
      const body = {
        name: 'Parque Central Norte',
        zoneId: 'zone-001',
        reason: 'Alta iluminación y flujo peatonal',
        safetyScore: 0.85,
        location: { lat: 4.6501, lng: -74.0502 },
      };

      const response = await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send(body)
        .expect(201);

      expect(response.body).toMatchObject({
        name: body.name,
        zoneId: body.zoneId,
        reason: body.reason,
        safetyScore: body.safetyScore,
        status: 'active',
      });
      expect(response.body.id).toBeDefined();

      // Verify audit row was created
      const auditRows = await dataSource.query<{ action: string; reason: string }[]>(
        `SELECT action, reason FROM safe_point_audit WHERE safe_point_id = $1`,
        [response.body.id],
      );
      expect(auditRows).toHaveLength(1);
      expect(auditRows[0].action).toBe('CREATE');
      expect(auditRows[0].reason).toBe(body.reason);
    });

    it('Given supervisor, when POST without reason, then 400 SafePointReasonRequiredError', async () => {
      const body = {
        name: 'Sin Razon',
        zoneId: 'zone-002',
        // reason intentionally omitted
        safetyScore: 0.5,
        location: { lat: 4.65, lng: -74.05 },
      };

      const response = await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send(body)
        .expect(400);

      expect(response.body.code).toBe('SAFE_POINT_REASON_REQUIRED');
    });
  });

  describe('PATCH /safe-points/:id', () => {
    it('Given a non-supervisor (rider), when PATCH, then 403 RbacForbiddenError', async () => {
      // First create a safe point as supervisor
      const createRes = await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send({
          name: 'Test Point',
          zoneId: 'zone-003',
          reason: 'Creacion inicial',
          safetyScore: 0.7,
          location: { lat: 4.65, lng: -74.05 },
        })
        .expect(201);

      const id = createRes.body.id;

      // Now try as rider
      await request(app.getHttpServer())
        .patch(`/safe-points/${id}`)
        .set(riderHeaders)
        .send({ reason: 'intento de cambio' })
        .expect(403);
    });

    it('Given existing safe point, when PATCH with new reason, then 200 + audit row with action=UPDATE', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send({
          name: 'Punto Original',
          zoneId: 'zone-004',
          reason: 'Razon original',
          safetyScore: 0.6,
          location: { lat: 4.66, lng: -74.06 },
        })
        .expect(201);

      const id = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/safe-points/${id}`)
        .set(supervisorHeaders)
        .send({ name: 'Punto Actualizado', auditReason: 'Correccion de nombre' })
        .expect(200);

      // Verify via DB that name was updated
      const dbRows = await dataSource.query<{ name: string }[]>(`SELECT name FROM safe_points WHERE id = $1`, [id]);
      expect(dbRows[0].name).toBe('Punto Actualizado');

      const auditRows = await dataSource.query<{ action: string }[]>(
        `SELECT action FROM safe_point_audit WHERE safe_point_id = $1 AND action = 'UPDATE'`,
        [id],
      );
      expect(auditRows).toHaveLength(1);
      expect(auditRows[0].action).toBe('UPDATE');
    });
  });

  describe('GET /safe-points/within', () => {
    it('Given safe points seeded, when GET /safe-points/within, then returns only those within ST_DWithin radius', async () => {
      // Seed two safe points: one inside 120m, one far away
      await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send({
          name: 'Punto Cercano',
          zoneId: 'zone-005',
          reason: 'Cercano al origen',
          safetyScore: 0.8,
          location: { lat: 4.6501, lng: -74.0501 }, // ~15m from query point
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send({
          name: 'Punto Lejano',
          zoneId: 'zone-005',
          reason: 'Muy lejos',
          safetyScore: 0.5,
          location: { lat: 4.7, lng: -74.1 }, // ~several km away
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/safe-points/within')
        .set(supervisorHeaders)
        .query({ lat: 4.65, lng: -74.05, radiusM: 120 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Punto Cercano');
    });
  });

  describe('DELETE /safe-points/:id', () => {
    it('Given existing safe point, when DELETE, then 204 + audit row with action=DELETE', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/safe-points')
        .set(supervisorHeaders)
        .send({
          name: 'Para Borrar',
          zoneId: 'zone-006',
          reason: 'Temporal',
          safetyScore: 0.4,
          location: { lat: 4.67, lng: -74.07 },
        })
        .expect(201);

      const id = createRes.body.id;

      await request(app.getHttpServer())
        .delete(`/safe-points/${id}`)
        .set(supervisorHeaders)
        .query({ reason: 'Ya no es necesario' })
        .expect(204);

      const auditRows = await dataSource.query<{ action: string }[]>(
        `SELECT action FROM safe_point_audit WHERE safe_point_id = $1 AND action = 'DELETE'`,
        [id],
      );
      expect(auditRows).toHaveLength(1);
      expect(auditRows[0].action).toBe('DELETE');
    });
  });
});
