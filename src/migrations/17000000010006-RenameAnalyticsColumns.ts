import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameAnalyticsColumns17000000010006 implements MigrationInterface {
  name = 'RenameAnalyticsColumns17000000010006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE analytics_events RENAME COLUMN rider_id TO user_id`);
    await queryRunner.query(`ALTER TABLE analytics_events RENAME COLUMN payload_json TO metadata`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE analytics_events RENAME COLUMN user_id TO rider_id`);
    await queryRunner.query(`ALTER TABLE analytics_events RENAME COLUMN metadata TO payload_json`);
  }
}
