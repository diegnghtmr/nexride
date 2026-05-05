import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDispatchDecisions17000000010002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dispatch_decisions (
        request_id          UUID          PRIMARY KEY,
        rider_id            TEXT          NOT NULL,
        original_lat        DOUBLE PRECISION NOT NULL,
        original_lng        DOUBLE PRECISION NOT NULL,
        suggested_lat       DOUBLE PRECISION,
        suggested_lng       DOUBLE PRECISION,
        suggested_point_id  UUID          REFERENCES safe_points(id),
        vehicle_id          TEXT          NOT NULL,
        scores_json         JSONB         NOT NULL,
        fallback_reason     TEXT,
        suggestion_status   TEXT          NOT NULL DEFAULT 'not_shown'
                              CHECK (suggestion_status IN ('shown','not_shown')),
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        trip_id             UUID,
        user_choice         TEXT          CHECK (user_choice IN ('original','suggested')),
        confirmed_at        TIMESTAMPTZ,
        pipeline_duration_ms INT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX dispatch_decisions_rider_idx ON dispatch_decisions (rider_id, created_at DESC)`,
    );
    await queryRunner.query(`CREATE INDEX dispatch_decisions_suggestion_idx ON dispatch_decisions (suggestion_status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dispatch_decisions`);
  }
}
