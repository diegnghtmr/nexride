import { GeoPoint } from './shared-types';
import { DistanceProviderTimeoutError } from '../errors/domain-error';

export interface DistanceResult {
  etaSeconds: number;
  distanceM: number;
  source: 'cache' | 'haversine';
}

/**
 * IDistanceProvider — contract for ETA/distance queries.
 * Throws DistanceProviderTimeoutError when all tiers fail.
 */
export interface IDistanceProvider {
  getEtaSeconds(from: GeoPoint, to: GeoPoint, signal?: AbortSignal): Promise<DistanceResult>;
}

// Re-export so callers don't need to import from errors directly
export { DistanceProviderTimeoutError };

export const DISTANCE_PROVIDER = Symbol('IDistanceProvider');
