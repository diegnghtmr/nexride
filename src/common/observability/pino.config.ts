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
      // Judgment 15° F2: rename Pino's default 'msg' field to 'message' to honour
      // the documented log-field contract (REQ-LOG header above).
      messageKey: 'message',
      transport:
        process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      formatters: {
        level: (label: string) => ({ level: label }),
        log: (obj: Record<string, unknown>): Record<string, unknown> => {
          // Whitelist map: camelCase domain fields → snake_case log contract (REQ-LOG-1..2, F4)
          const map: Record<string, string> = {
            requestId: 'request_id',
            tripId: 'trip_id',
            riderId: 'rider_id',
            userId: 'user_id',
            zoneId: 'zone_id',
            vehicleId: 'vehicle_id',
          };
          const out: Record<string, unknown> = { ...obj };
          for (const [from, to] of Object.entries(map)) {
            if (from in out) {
              out[to] = out[from];
              delete out[from];
            }
          }
          return out;
        },
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customProps: (req: any) => ({
        module: req['module'] ?? 'http',
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
