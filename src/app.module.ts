import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { RequestIdMiddleware } from './common/observability/request-id.middleware';
import { buildPinoConfig } from './common/observability/pino.config';

@Module({
  imports: [
    // Global config — loadDispatchConfig wired via ConfigModule.forRoot
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Structured logging via pino (design §8)
    LoggerModule.forRoot(buildPinoConfig()),

    // TypeORM — placeholder; full config added in Phase 3 after entities are ready
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
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
