import { IDistanceProvider, DistanceResult } from '../../../common/interfaces/IDistanceProvider';
import { DispatchConfig } from '../../../common/config/dispatch.config';
import { GeoPoint } from '../../domain/value-objects/geo-point.vo';
import { DistanceProviderTimeoutError } from '../../../common/errors/domain-error';

/** Minimal Redis client interface — avoids a hard dependency on ioredis types in tests */
export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  setEx(key: string, ttlSec: number, value: string): Promise<unknown>;
}

const AVG_SPEED_KMH = 25; // urban average; externalisable if needed

function buildCacheKey(from: GeoPoint, to: GeoPoint): string {
  // Round to 5 decimal places (~1m precision) to improve cache hit-rate
  const round5 = (n: number) => Math.round(n * 100_000) / 100_000;
  return `distance:${round5(from.lat)}:${round5(from.lng)}:${round5(to.lat)}:${round5(to.lng)}`;
}

function haversineDistanceM(from: GeoPoint, to: GeoPoint): number {
  return from.distanceKmHaversine(to) * 1000;
}

export class HaversineDistanceProvider implements IDistanceProvider {
  constructor(
    private readonly redis: RedisClientLike,
    private readonly cfg: DispatchConfig,
  ) {}

  async getEtaSeconds(from: GeoPoint, to: GeoPoint, _signal?: AbortSignal): Promise<DistanceResult> {
    // Fault injection for testing and perf scenarios
    if (this.cfg.distance.injectTimeout) {
      throw new DistanceProviderTimeoutError('Distance provider timeout injected', { from, to });
    }

    const cacheKey = buildCacheKey(from, to);

    // Tier 1 — Redis cache
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      const parsed = JSON.parse(cached) as { etaSeconds: number; distanceM: number };
      return { ...parsed, source: 'cache' };
    }

    // Tier 2 — Haversine computation
    const distanceM = haversineDistanceM(from, to);
    const speedMps = (AVG_SPEED_KMH * 1000) / 3600;
    const etaSeconds = distanceM / speedMps;

    const result: DistanceResult = { etaSeconds, distanceM, source: 'haversine' };

    // Write to cache with TTL
    await this.redis.setEx(cacheKey, this.cfg.distance.cacheTtlSec, JSON.stringify({ etaSeconds, distanceM }));

    return result;
  }
}
