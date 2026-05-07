import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigurableThrottlerGuard } from './common/guards/configurable-throttler.guard';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { RequestIdMiddleware } from './common/observability/request-id.middleware';
import { buildPinoConfig } from './common/observability/pino.config';
import { ObservabilityModule } from './common/observability/observability.module';
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
import { EnablePostgis17000000010000 } from './migrations/17000000010000-EnablePostgis';
import { CreateSafePoints17000000010001 } from './migrations/17000000010001-CreateSafePoints';
import { CreateDispatchDecisions17000000010002 } from './migrations/17000000010002-CreateDispatchDecisions';
import { CreateTrips17000000010003 } from './migrations/17000000010003-CreateTrips';
import { CreateAnalyticsEvents17000000010004 } from './migrations/17000000010004-CreateAnalyticsEvents';
import { AddDestinationToDispatchDecisions17000000010005 } from './migrations/17000000010005-AddDestinationToDispatchDecisions';
import { RenameAnalyticsColumns17000000010006 } from './migrations/17000000010006-RenameAnalyticsColumns';

@Module({
  imports: [
    // Global config — loadDispatchConfig wired via ConfigModule.forRoot
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Structured logging via pino (design §8)
    LoggerModule.forRoot(buildPinoConfig()),

    // Observability — exposes GET /metrics with Prometheus registry (REQ-FIX-03)
    ObservabilityModule,

    // NFR-17: two-tier rate limiting — 100 req/min per user (JWT userId), 1000 req/min per IP.
    // Each named throttler has its own getTracker so keys are independent:
    //   user throttler: key = req.user?.id ?? req.ip  (authenticated users bucketed by userId)
    //   ip   throttler: key = req.ip                   (all traffic bucketed by IP regardless of auth)
    //
    // Escape hatches (per route or controller):
    //   @SkipThrottle({ user: true, ip: true })   — skip all named throttlers
    //   @Throttle({ user: { limit: N, ttl: T } }) — override per named throttler
    //
    // Test knobs (env-driven, never set in production):
    //   THROTTLER_DISABLED=1         — bypass BOTH throttlers (see ConfigurableThrottlerGuard)
    //   THROTTLER_TEST_LIMIT=10      — override ip throttler limit (test/integration/rides/throttling.spec.ts)
    //   THROTTLE_USER_LIMIT=N        — override user throttler limit
    //   THROTTLE_IP_LIMIT=N          — override ip throttler limit (non-test override)
    ThrottlerModule.forRoot([
      {
        name: 'user',
        ttl: 60_000,
        limit: parseInt(process.env['THROTTLE_USER_LIMIT'] ?? '100', 10),
        getTracker: (req: Record<string, unknown>) => {
          const user = req['user'] as { id?: unknown } | undefined;
          const userId = user?.id;
          return userId ? (userId as string) : ((req['ip'] as string | undefined) ?? 'anonymous');
        },
      },
      {
        name: 'ip',
        ttl: 60_000,
        // Limit is a lazy function so THROTTLER_TEST_LIMIT is read at request time,
        // not at module-decorator evaluation time (which runs at import in Node.js).
        // This allows integration tests to set the env var in beforeAll and have it
        // take effect even though AppModule is statically imported at file parse time.
        limit: () =>
          parseInt(
            process.env['THROTTLER_TEST_LIMIT'] ?? process.env['THROTTLE_IP_LIMIT'] ?? '1000',
            10,
          ),
        getTracker: (req: Record<string, unknown>) =>
          (req['ip'] as string | undefined) ?? 'anonymous',
      },
    ]),

    // TypeORM — env-driven config; migrations registered (design §5)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [
          EnablePostgis17000000010000,
          CreateSafePoints17000000010001,
          CreateDispatchDecisions17000000010002,
          CreateTrips17000000010003,
          CreateAnalyticsEvents17000000010004,
          AddDestinationToDispatchDecisions17000000010005,
          RenameAnalyticsColumns17000000010006,
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

    // Global rate limiting guard (REQ-FIX-V8-08 / F10)
    // ConfigurableThrottlerGuard extends ThrottlerGuard with THROTTLER_DISABLED bypass.
    // Set THROTTLER_DISABLED=1 in integration test environments to skip rate limiting.
    {
      provide: APP_GUARD,
      useClass: ConfigurableThrottlerGuard,
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
    consumer.apply(RequestIdMiddleware).forRoutes('/{*splat}');
  }
}
