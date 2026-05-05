import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePostgis1700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Dropping postgis would destroy geographic data — intentionally a no-op.
    // To drop, do it manually: DROP EXTENSION IF EXISTS postgis CASCADE;
  }
}
