/**
 * SafePoints Transactional Atomicity — Integration Test (T-029 · RED · F8)
 *
 * Strict TDD: This file is the RED commit — written BEFORE the transactional
 * implementation in SafePointsService/SafePointsRepository.
 *
 * Verifies that when writeAudit fails mid-transaction, the safe_points row
 * is NOT committed (ROLLBACK). Uses Testcontainers PostGIS to run real SQL.
 *
 * Scenarios:
 * 1. audit FK violation (invalid safe_point_id constraint) rolls back safe_points insert
 * 2. Both rows committed atomically when both succeed
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { APP_FILTER } from '@nestjs/core';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DomainExceptionFilter } from '../../../src/common/filters/domain-exception.filter';
import { SafePointsModule } from '../../../src/safe-points/safe-points.module';
import { SafePointsService } from '../../../src/safe-points/safe-points.service';
import { SafePointEntity } from '../../../src/safe-points/infrastructure/safe-point.entity';
import { SafePointAuditEntity } from '../../../src/safe-points/infrastructure/safe-point-audit.entity';

describe('SafePoints Transactional Atomicity (integration · T-029)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let dataSource: DataSource;
  let service: SafePointsService;

  const validInput = {
    name: 'Punto TX Test',
    zoneId: 'zone-tx',
    reason: 'Test transactional',
    safetyScore: 0.75,
    location: { lat: 4.65, lng: -74.05 },
    createdBy: 'tx-user',
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
      .withDatabase('nexride_tx_test')
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
    service = module.get<SafePointsService>(SafePointsService);

    // Create schema
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

  it('1. successful create: both safe_points and audit rows committed atomically', async () => {
    const result = await service.create(validInput);

    expect(result.id).toBeDefined();
    expect(result.name).toBe(validInput.name);

    const spRows = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM safe_points WHERE id = $1`,
      [result.id],
    );
    expect(spRows).toHaveLength(1);

    const auditRows = await dataSource.query<{ action: string }[]>(
      `SELECT action FROM safe_point_audit WHERE safe_point_id = $1`,
      [result.id],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe('CREATE');
  });

  it('2. when audit insert fails, safe_points row is NOT committed (ROLLBACK)', async () => {
    // Force audit to fail by temporarily adding a CHECK constraint that rejects our reason
    // We use a DB-level trigger approach: temporarily drop and recreate audit table with invalid constraint
    // Simpler approach: use an invalid changed_by value that violates a length constraint we add temporarily
    // Cleanest approach: inject a modified service that forces the audit to use an invalid action value

    // Strategy: Add a BEFORE INSERT trigger on safe_point_audit that raises an exception
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION raise_audit_error()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'FORCED_AUDIT_FAILURE for test atomicity';
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER safe_point_audit_force_fail
      BEFORE INSERT ON safe_point_audit
      FOR EACH ROW EXECUTE FUNCTION raise_audit_error()
    `);

    // Act: service.create should fail because the trigger blocks the audit write
    await expect(
      service.create({
        ...validInput,
        name: 'TX Rollback Test',
      }),
    ).rejects.toThrow();

    // Assert: safe_points table must be empty — the transaction was rolled back
    const spRows = await dataSource.query<{ count: string }[]>(
      `SELECT count(*)::int AS count FROM safe_points WHERE name = 'TX Rollback Test'`,
    );
    expect(spRows[0].count).toBe(0);

    // Cleanup trigger
    await dataSource.query(`DROP TRIGGER IF EXISTS safe_point_audit_force_fail ON safe_point_audit`);
    await dataSource.query(`DROP FUNCTION IF EXISTS raise_audit_error`);
  });
});
