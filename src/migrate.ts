import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SafePointEntity } from './safe-points/infrastructure/safe-point.entity';
import { SafePointAuditEntity } from './safe-points/infrastructure/safe-point-audit.entity';
import { DispatchDecisionEntity } from './dispatch/infrastructure/persistence/dispatch-decision.entity';
import { TripEntity } from './trip/infrastructure/trip.entity';
import { AnalyticsEventEntity } from './analytics/infrastructure/analytics-event.entity';
import { EnablePostgis1700000000 } from './migrations/1700000000-EnablePostgis';
import { CreateSafePoints1700000001 } from './migrations/1700000001-CreateSafePoints';
import { CreateDispatchDecisions1700000002 } from './migrations/1700000002-CreateDispatchDecisions';
import { CreateTrips1700000003 } from './migrations/1700000003-CreateTrips';
import { CreateAnalyticsEvents1700000004 } from './migrations/1700000004-CreateAnalyticsEvents';
import { AddDestinationToDispatchDecisions1700000005 } from './migrations/1700000005-AddDestinationToDispatchDecisions';

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [SafePointEntity, SafePointAuditEntity, DispatchDecisionEntity, TripEntity, AnalyticsEventEntity],
  migrations: [
    EnablePostgis1700000000,
    CreateSafePoints1700000001,
    CreateDispatchDecisions1700000002,
    CreateTrips1700000003,
    CreateAnalyticsEvents1700000004,
    AddDestinationToDispatchDecisions1700000005,
  ],
  synchronize: false,
  logging: false,
});

export async function run(): Promise<void> {
  await dataSource.initialize();
  try {
    const ran = await dataSource.runMigrations({ transaction: 'each' });
    console.log(`Ran ${ran.length} migrations`);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
