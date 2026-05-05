import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSafePoints17000000010001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // safe_points table (design §5)
    await queryRunner.query(`
      CREATE TABLE safe_points (
        id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(120)  NOT NULL,
        zone_id     VARCHAR(60)   NOT NULL,
        reason      VARCHAR(255)  NOT NULL,
        location    geography(Point,4326) NOT NULL,
        safety_score NUMERIC(4,3) NOT NULL CHECK (safety_score BETWEEN 0 AND 1),
        status      VARCHAR(20)   NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive')),
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        created_by  TEXT,
        updated_by  TEXT
      )
    `);

    // GIST index for fast geographic proximity lookups (ST_DWithin)
    await queryRunner.query(`CREATE INDEX safe_points_location_gix ON safe_points USING GIST (location)`);

    await queryRunner.query(`CREATE INDEX safe_points_status_idx ON safe_points (status)`);

    // safe_point_audit table
    await queryRunner.query(`
      CREATE TABLE safe_point_audit (
        id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        safe_point_id UUID          REFERENCES safe_points(id) ON DELETE SET NULL,
        action        VARCHAR(20)   NOT NULL
                        CHECK (action IN ('CREATE','UPDATE','DEACTIVATE','ACTIVATE','DELETE')),
        reason        VARCHAR(255)  NOT NULL,
        changed_by    TEXT          NOT NULL,
        changed_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        snapshot      JSONB
      )
    `);

    await queryRunner.query(
      `CREATE INDEX safe_point_audit_sp_idx ON safe_point_audit (safe_point_id, changed_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS safe_point_audit`);
    await queryRunner.query(`DROP TABLE IF EXISTS safe_points`);
  }
}
