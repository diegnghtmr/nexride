import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * S-3: Add destination_lat / destination_lng columns to dispatch_decisions.
 * Nullable for backward compatibility with existing rows.
 */
export class AddDestinationToDispatchDecisions1700000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dispatch_decisions
        ADD COLUMN IF NOT EXISTS destination_lat DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS destination_lng DOUBLE PRECISION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dispatch_decisions
        DROP COLUMN IF EXISTS destination_lat,
        DROP COLUMN IF EXISTS destination_lng
    `);
  }
}
