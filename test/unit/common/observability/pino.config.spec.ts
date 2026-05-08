/**
 * Unit tests for pino transport config (verify W-7)
 *
 * Validates that buildPinoConfig() produces a configuration that:
 * 1. Emits all required log fields: timestamp, level, module, request_id, message
 * 2. Redacts Authorization and Cookie headers
 * 3. Respects LOG_LEVEL env var
 * 4. Uses pino-pretty transport in non-production environments
 *
 * Note: full in-band log capture (W-7 integration assertion) requires Docker
 * for Testcontainers. These unit tests validate the config contract by
 * inspecting the pinoHttp options directly, which is sufficient for solo-dev
 * CI environments without Docker.
 */

import { buildPinoConfig } from '../../../../src/common/observability/pino.config';

describe('buildPinoConfig()', () => {
  const ORIGINAL_NODE_ENV = process.env['NODE_ENV'];
  const ORIGINAL_LOG_LEVEL = process.env['LOG_LEVEL'];

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = ORIGINAL_NODE_ENV;
    }
    if (ORIGINAL_LOG_LEVEL === undefined) {
      delete process.env['LOG_LEVEL'];
    } else {
      process.env['LOG_LEVEL'] = ORIGINAL_LOG_LEVEL;
    }
  });

  it('returns a config object with pinoHttp key', () => {
    const config = buildPinoConfig();
    expect(config).toHaveProperty('pinoHttp');
    expect(config.pinoHttp).toBeDefined();
  });

  it('produces a timestamp field conforming to ISO-8601 format', () => {
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    const timestampFn = pinoHttp['timestamp'] as () => string;
    expect(typeof timestampFn).toBe('function');
    const raw = timestampFn();
    // Should produce `,"timestamp":"<ISO string>"`
    expect(raw).toMatch(/,"timestamp":"[^"]+"/);
    // Verify it contains a valid ISO-8601 date — extract the value after "timestamp":"
    const match = raw.match(/"timestamp":"([^"]+)"/);
    expect(match).not.toBeNull();
    const ts = new Date(match![1]);
    expect(isNaN(ts.getTime())).toBe(false);
  });

  it('formats level field as { level: label } object', () => {
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    const formatters = pinoHttp['formatters'] as Record<string, (label: string) => Record<string, string>>;
    const levelFormatter = formatters['level'];
    expect(typeof levelFormatter).toBe('function');
    expect(levelFormatter('info')).toEqual({ level: 'info' });
    expect(levelFormatter('error')).toEqual({ level: 'error' });
  });

  it('customProps produces all required log fields: module, request_id, trip_id, user_id, zone_id, metadata', () => {
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    const customProps = pinoHttp['customProps'] as (req: Record<string, unknown>) => Record<string, unknown>;

    // Simulate a minimal request object with all relevant fields
    const mockReq = {
      module: 'dispatch',
      correlationId: 'corr-001',
      tripId: 'trip-001',
      user: { id: 'rider-001' },
      zoneId: 'zone-1',
      metadata: { extra: 'data' },
    };

    const props = customProps(mockReq);

    // W-7 assertion: all required fields must be present (with allowed null for optional ones)
    expect(props).toHaveProperty('module', 'dispatch');
    expect(props).toHaveProperty('request_id', 'corr-001');
    expect(props).toHaveProperty('trip_id', 'trip-001');
    expect(props).toHaveProperty('user_id', 'rider-001');
    expect(props).toHaveProperty('zone_id', 'zone-1');
    expect(props).toHaveProperty('metadata', { extra: 'data' });
  });

  it('customProps uses null defaults for missing optional fields', () => {
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    const customProps = pinoHttp['customProps'] as (req: Record<string, unknown>) => Record<string, unknown>;

    // Request without optional fields (pre-confirm, trip_id may be null)
    const props = customProps({});

    expect(props['module']).toBe('http');
    expect(props['request_id']).toBeNull();
    expect(props['trip_id']).toBeNull();
    expect(props['user_id']).toBeNull();
    expect(props['zone_id']).toBeNull();
    expect(props['metadata']).toEqual({});
  });

  it('redacts Authorization and Cookie headers', () => {
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    const redact = pinoHttp['redact'] as string[];

    expect(redact).toContain('req.headers.authorization');
    expect(redact).toContain('req.headers.cookie');
  });

  it('uses LOG_LEVEL env var when set', () => {
    process.env['LOG_LEVEL'] = 'debug';
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    expect(pinoHttp['level']).toBe('debug');
  });

  it('defaults to info when LOG_LEVEL is not set', () => {
    delete process.env['LOG_LEVEL'];
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    expect(pinoHttp['level']).toBe('info');
  });

  it('enables pino-pretty transport in non-production environment', () => {
    process.env['NODE_ENV'] = 'test';
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    const transport = pinoHttp['transport'] as Record<string, unknown> | undefined;
    expect(transport).toBeDefined();
    expect(transport!['target']).toBe('pino-pretty');
  });

  it('disables pino-pretty transport in production', () => {
    process.env['NODE_ENV'] = 'production';
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    expect(pinoHttp['transport']).toBeUndefined();
  });

  // Judgment 15° F2: the doc contract (header comment + W-7) declares 'message'
  // as a required log field, but Pino emits 'msg' by default. messageKey:'message'
  // renames it so the contract holds.
  it("sets messageKey:'message' to honour the documented log-field contract", () => {
    const config = buildPinoConfig();
    const pinoHttp = config.pinoHttp as Record<string, unknown>;
    expect(pinoHttp['messageKey']).toBe('message');
  });
});
