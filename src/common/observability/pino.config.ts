import { Params } from 'nestjs-pino';

/**
 * Pino HTTP options factory per design §8.
 * Required log fields: timestamp, level, module, request_id, trip_id,
 * user_id, zone_id, message, metadata.
 * Bearer tokens in Authorization header are redacted.
 */
export function buildPinoConfig(): Params {
  return {
    pinoHttp: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customProps: (req: any) => ({
        module: req['module'] ?? 'unknown',
        request_id: req['correlationId'] ?? null,
        trip_id: req['tripId'] ?? null,
        user_id: req['user']?.id ?? null,
        zone_id: req['zoneId'] ?? null,
        metadata: req['metadata'] ?? {},
      }),
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  };
}
