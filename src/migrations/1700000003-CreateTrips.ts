import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrips1700000003 implements MigrationInterface {
  name = 'CreateTrips1700000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id          UUID NOT NULL UNIQUE REFERENCES dispatch_decisions(request_id),
        rider_id            TEXT NOT NULL,
        vehicle_id          TEXT NOT NULL,
        pickup_type         TEXT NOT NULL CHECK (pickup_type IN ('original','suggested')),
        suggested_point_id  UUID REFERENCES safe_points(id),
        pickup_lat          DOUBLE PRECISION NOT NULL,
        pickup_lng          DOUBLE PRECISION NOT NULL,
        destination_lat     DOUBLE PRECISION NOT NULL,
        destination_lng     DOUBLE PRECISION NOT NULL,
        status              TEXT NOT NULL CHECK (status IN ('requested','assigned','in_progress','completed','cancelled'))
                              DEFAULT 'assigned',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trips_rider_idx ON trips (rider_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trips_vehicle_idx ON trips (vehicle_id, status)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS trips CASCADE`);
  }
}
