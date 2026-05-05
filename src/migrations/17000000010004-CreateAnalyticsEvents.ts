import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnalyticsEvents17000000010004 implements MigrationInterface {
  name = 'CreateAnalyticsEvents17000000010004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id              BIGSERIAL PRIMARY KEY,
        event_name      TEXT NOT NULL,
        request_id      UUID,
        trip_id         UUID,
        rider_id        TEXT,
        payload_json    JSONB NOT NULL,
        occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS analytics_events_name_idx
        ON analytics_events (event_name, occurred_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS analytics_events_request_idx
        ON analytics_events (request_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS analytics_events CASCADE`);
  }
}
