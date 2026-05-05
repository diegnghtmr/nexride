import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    // Global config — validation added in Phase 2 when env.validation.ts is created
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Structured logging via pino
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['LOG_LEVEL'] ?? 'info',
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customProps: (req: any) => ({
          module: req['module'],
          request_id: req['correlationId'],
          user_id: req['user']?.id,
          zone_id: req['zoneId'],
        }),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),

    // TypeORM — placeholder; full config added in Phase 2 after env.validation.ts
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        // migrations loaded in Phase 3 when entities are ready
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

    // Feature modules — wired in Phase 2-5
  ],
})
export class AppModule {}
