import { loadDispatchConfig, ConfigValidationError } from '../../../../src/common/config/dispatch.config';

describe('loadDispatchConfig', () => {
  const validEnv: NodeJS.ProcessEnv = {
    DISPATCH_CANDIDATE_RADIUS_KM: '5',
    DISPATCH_SAFE_POINT_RADIUS_M: '120',
    DISPATCH_SUGGESTION_THRESHOLD_PCT: '0.15',
    DISPATCH_ORIGINAL_SAFETY_BASELINE: '0.30',
    DISPATCH_W_PROXIMITY: '0.30',
    DISPATCH_W_ENERGY: '0.25',
    DISPATCH_W_SAFETY: '0.25',
    DISPATCH_W_CONTINUITY: '0.20',
    DISPATCH_PIPELINE_TIMEOUT_MS: '1200',
    DISPATCH_FALLBACK_MIN_BATTERY: '20',
    DISPATCH_MAX_ETA_SECONDS: '600',
    FLEET_MINIMUM_RESERVE_PCT: '0.15',
    FLEET_TELEMETRY_STALENESS_SEC: '60',
    DISTANCE_CACHE_TTL_SEC: '60',
    DISTANCE_PROVIDER_TIMEOUT_MS: '800',
  };

  it('returns typed config with all fields when env is valid', () => {
    const config = loadDispatchConfig(validEnv);

    expect(config.candidateRadiusKm).toBe(5);
    expect(config.safePointRadiusM).toBe(120);
    expect(config.suggestionThresholdPct).toBe(0.15);
    expect(config.originalSafetyBaseline).toBe(0.3);
    expect(config.weights.proximity).toBe(0.3);
    expect(config.weights.energy).toBe(0.25);
    expect(config.weights.safety).toBe(0.25);
    expect(config.weights.continuity).toBe(0.2);
    expect(config.pipelineTimeoutMs).toBe(1200);
    expect(config.fallbackMinBatteryPct).toBe(20);
    expect(config.maxEtaSeconds).toBe(600);
    expect(config.fleet.minimumReservePct).toBe(0.15);
    expect(config.fleet.telemetryStalenessSec).toBe(60);
    expect(config.distance.cacheTtlSec).toBe(60);
    expect(config.distance.providerTimeoutMs).toBe(800);
  });

  it('applies defaults when env vars are missing', () => {
    const config = loadDispatchConfig({});

    expect(config.candidateRadiusKm).toBe(5);
    expect(config.safePointRadiusM).toBe(120);
    expect(config.pipelineTimeoutMs).toBe(1200);
    expect(config.weights.proximity).toBe(0.3);
    expect(config.weights.energy).toBe(0.25);
    expect(config.weights.safety).toBe(0.25);
    expect(config.weights.continuity).toBe(0.2);
  });

  it('throws ConfigValidationError when a numeric field is not a valid number', () => {
    const env = { ...validEnv, DISPATCH_CANDIDATE_RADIUS_KM: 'not-a-number' };

    expect(() => loadDispatchConfig(env)).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when weights do not sum to 1.0', () => {
    const env = {
      ...validEnv,
      DISPATCH_W_PROXIMITY: '0.40',
      DISPATCH_W_ENERGY: '0.30',
      DISPATCH_W_SAFETY: '0.20',
      DISPATCH_W_CONTINUITY: '0.20',
    };

    expect(() => loadDispatchConfig(env)).toThrow(ConfigValidationError);
  });

  it('accepts candidateRadiusKm = 0 as valid boundary', () => {
    const env = { ...validEnv, DISPATCH_CANDIDATE_RADIUS_KM: '0' };
    const config = loadDispatchConfig(env);

    expect(config.candidateRadiusKm).toBe(0);
  });

  it('accepts pipelineTimeoutMs = 0 as valid boundary', () => {
    const env = { ...validEnv, DISPATCH_PIPELINE_TIMEOUT_MS: '0' };
    const config = loadDispatchConfig(env);

    expect(config.pipelineTimeoutMs).toBe(0);
  });

  it('throws ConfigValidationError when weights sum is outside ±0.001 tolerance', () => {
    const env = {
      ...validEnv,
      DISPATCH_W_PROXIMITY: '0.30',
      DISPATCH_W_ENERGY: '0.25',
      DISPATCH_W_SAFETY: '0.25',
      DISPATCH_W_CONTINUITY: '0.21',
    };

    expect(() => loadDispatchConfig(env)).toThrow(ConfigValidationError);
  });
});
