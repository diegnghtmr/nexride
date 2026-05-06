import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SafePointEntity } from './safe-points/infrastructure/safe-point.entity';
import { SafePointAuditEntity } from './safe-points/infrastructure/safe-point-audit.entity';
import { DispatchDecisionEntity } from './dispatch/infrastructure/persistence/dispatch-decision.entity';
import { TripEntity } from './trip/infrastructure/trip.entity';
import { AnalyticsEventEntity } from './analytics/infrastructure/analytics-event.entity';
import { EnablePostgis17000000010000 } from './migrations/17000000010000-EnablePostgis';
import { CreateSafePoints17000000010001 } from './migrations/17000000010001-CreateSafePoints';
import { CreateDispatchDecisions17000000010002 } from './migrations/17000000010002-CreateDispatchDecisions';
import { CreateTrips17000000010003 } from './migrations/17000000010003-CreateTrips';
import { CreateAnalyticsEvents17000000010004 } from './migrations/17000000010004-CreateAnalyticsEvents';
import { AddDestinationToDispatchDecisions17000000010005 } from './migrations/17000000010005-AddDestinationToDispatchDecisions';
import { RenameAnalyticsColumns17000000010006 } from './migrations/17000000010006-RenameAnalyticsColumns';

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [SafePointEntity, SafePointAuditEntity, DispatchDecisionEntity, TripEntity, AnalyticsEventEntity],
  migrations: [
    EnablePostgis17000000010000,
    CreateSafePoints17000000010001,
    CreateDispatchDecisions17000000010002,
    CreateTrips17000000010003,
    CreateAnalyticsEvents17000000010004,
    AddDestinationToDispatchDecisions17000000010005,
    RenameAnalyticsColumns17000000010006,
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
