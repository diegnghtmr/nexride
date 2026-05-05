import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { RequestIdMiddleware } from './common/observability/request-id.middleware';
import { buildPinoConfig } from './common/observability/pino.config';
import { SafePointsModule } from './safe-points/safe-points.module';
import { FleetModule } from './fleet/fleet.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { TripModule } from './trip/trip.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RiderModule } from './rider/rider.module';
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

@Module({
  imports: [
    // Global config — loadDispatchConfig wired via ConfigModule.forRoot
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Structured logging via pino (design §8)
    LoggerModule.forRoot(buildPinoConfig()),

    // TypeORM — env-driven config; migrations registered (design §5)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [
          EnablePostgis1700000000,
          CreateSafePoints1700000001,
          CreateDispatchDecisions1700000002,
          CreateTrips1700000003,
          CreateAnalyticsEvents1700000004,
        ],
        migrationsRun: false, // run explicitly via `npm run migrate`
        entities: [SafePointEntity, SafePointAuditEntity, DispatchDecisionEntity, TripEntity, AnalyticsEventEntity],
      }),
      inject: [ConfigService],
    }),

    // In-process event bus (ADR-005)
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),

    // Feature modules
    SafePointsModule,
    FleetModule,
    TripModule,
    DispatchModule,
    AnalyticsModule,
    RiderModule,
  ],

  providers: [
    // Global exception filter — maps DomainError → typed JSON (design §9)
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },

    // Global validation pipe — whitelist/transform/forbidNonWhitelisted
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // RequestIdMiddleware assigns correlationId to all requests
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
