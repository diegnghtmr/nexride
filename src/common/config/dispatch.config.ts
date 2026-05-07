export class ConfigValidationError extends Error {
  readonly code = 'CONFIG_VALIDATION_ERROR';
  readonly httpStatus = 500;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export interface DispatchWeights {
  proximity: number;
  energy: number;
  safety: number;
  continuity: number;
}

export interface DispatchFleetConfig {
  minimumReservePct: number;
  telemetryStalenessSec: number;
}

export interface DispatchScoringConfig {
  continuityBatteryWeight: number;
  continuityZoneWeight: number;
}

export interface DispatchDistanceConfig {
  cacheTtlSec: number;
  providerTimeoutMs: number;
  injectTimeout?: boolean;
}

export interface DispatchConfig {
  candidateRadiusKm: number;
  safePointRadiusM: number;
  suggestionThresholdPct: number;
  originalSafetyBaseline: number;
  weights: DispatchWeights;
  scoring: DispatchScoringConfig;
  pipelineTimeoutMs: number;
  fallbackMinBatteryPct: number;
  maxEtaSeconds: number;
  fleet: DispatchFleetConfig;
  distance: DispatchDistanceConfig;
}

function parseNumber(env: NodeJS.ProcessEnv, key: string, defaultValue: number): number {
  const raw = env[key];
  if (raw === undefined || raw === null || raw === '') {
    return defaultValue;
  }
  const parsed = Number(raw);
  if (isNaN(parsed)) {
    throw new ConfigValidationError(`Configuration error: ${key} must be a valid number, got "${raw}"`);
  }
  return parsed;
}

function validateWeights(weights: DispatchWeights): void {
  const sum = weights.proximity + weights.energy + weights.safety + weights.continuity;
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new ConfigValidationError(
      `Configuration error: dispatch weights must sum to 1.0 ±0.001, got ${sum.toFixed(6)}`,
    );
  }
}

function validateContinuityWeights(scoring: DispatchScoringConfig): void {
  const sum = scoring.continuityBatteryWeight + scoring.continuityZoneWeight;
  if (Math.abs(sum - 1.0) > 1e-6) {
    throw new ConfigValidationError(
      `Configuration error: continuity weights must sum to 1.0 ±1e-6, got ${sum.toFixed(9)}`,
    );
  }
}

export function loadDispatchConfig(env: NodeJS.ProcessEnv): DispatchConfig {
  const weights: DispatchWeights = {
    proximity: parseNumber(env, 'DISPATCH_W_PROXIMITY', 0.3),
    energy: parseNumber(env, 'DISPATCH_W_ENERGY', 0.25),
    safety: parseNumber(env, 'DISPATCH_W_SAFETY', 0.25),
    continuity: parseNumber(env, 'DISPATCH_W_CONTINUITY', 0.2),
  };

  validateWeights(weights);

  const scoring: DispatchScoringConfig = {
    continuityBatteryWeight: parseNumber(env, 'DISPATCH_SCORING_CONTINUITY_BATTERY_WEIGHT', 0.7),
    continuityZoneWeight: parseNumber(env, 'DISPATCH_SCORING_CONTINUITY_ZONE_WEIGHT', 0.3),
  };

  validateContinuityWeights(scoring);

  return {
    candidateRadiusKm: parseNumber(env, 'DISPATCH_CANDIDATE_RADIUS_KM', 5),
    safePointRadiusM: parseNumber(env, 'DISPATCH_SAFE_POINT_RADIUS_M', 120),
    suggestionThresholdPct: parseNumber(env, 'DISPATCH_SUGGESTION_THRESHOLD_PCT', 0.15),
    originalSafetyBaseline: parseNumber(env, 'DISPATCH_ORIGINAL_SAFETY_BASELINE', 0.3),
    weights,
    scoring,
    pipelineTimeoutMs: parseNumber(env, 'DISPATCH_PIPELINE_TIMEOUT_MS', 1200),
    fallbackMinBatteryPct: parseNumber(env, 'DISPATCH_FALLBACK_MIN_BATTERY', 20),
    maxEtaSeconds: parseNumber(env, 'DISPATCH_MAX_ETA_SECONDS', 600),
    fleet: {
      minimumReservePct: parseNumber(env, 'FLEET_MINIMUM_RESERVE_PCT', 0.15),
      telemetryStalenessSec: parseNumber(env, 'FLEET_TELEMETRY_STALENESS_SEC', 60),
    },
    distance: {
      cacheTtlSec: parseNumber(env, 'DISTANCE_CACHE_TTL_SEC', 60),
      providerTimeoutMs: parseNumber(env, 'DISTANCE_PROVIDER_TIMEOUT_MS', 800),
      injectTimeout: env['DISTANCE_INJECT_TIMEOUT'] === 'true',
    },
  };
}
