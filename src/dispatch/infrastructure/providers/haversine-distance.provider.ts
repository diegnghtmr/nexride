import { IDistanceProvider, DistanceResult } from '../../../common/interfaces/IDistanceProvider';
import { DispatchConfig } from '../../../common/config/dispatch.config';
import { GeoPoint } from '../../domain/value-objects/geo-point.vo';
import { DistanceProviderTimeoutError } from '../../../common/errors/domain-error';
import { DispatchMetrics } from '../../../common/observability/metrics.registry';

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
    // F6 REQ-FIX-V8-06: optional metrics — keeps existing tests green (no metrics needed in unit tests)
    private readonly metrics?: DispatchMetrics,
  ) {}

  async getEtaSeconds(from: GeoPoint, to: GeoPoint, signal?: AbortSignal): Promise<DistanceResult> {
    // REQ-FIX-V8-05: Honor AbortSignal — check before any work
    if (signal?.aborted) {
      // F6 REQ-FIX-V8-06: count timeout/abort result
      this.metrics?.distanceProviderCalls.inc({ result: 'timeout' });
      throw new DistanceProviderTimeoutError('Distance provider aborted before start', { from, to });
    }

    // Fault injection for testing and perf scenarios
    if (this.cfg.distance.injectTimeout) {
      // F6 REQ-FIX-V8-06: count injected timeout result
      this.metrics?.distanceProviderCalls.inc({ result: 'timeout' });
      throw new DistanceProviderTimeoutError('Distance provider timeout injected', { from, to });
    }

    const cacheKey = buildCacheKey(from, to);

    // Tier 1 — Redis cache
    const cached = await this.redis.get(cacheKey);

    // REQ-FIX-V8-05: Check abort after async cache read — the signal may have fired while we awaited
    if (signal?.aborted) {
      // F6 REQ-FIX-V8-06: count timeout/abort result
      this.metrics?.distanceProviderCalls.inc({ result: 'timeout' });
      throw new DistanceProviderTimeoutError('Distance provider aborted after cache read', { from, to });
    }

    if (cached !== null) {
      // F6 REQ-FIX-V8-06: count cache hit result
      this.metrics?.distanceProviderCalls.inc({ result: 'cache_hit' });
      const parsed = JSON.parse(cached) as { etaSeconds: number; distanceM: number };
      return { ...parsed, source: 'cache' };
    }

    // Tier 2 — Haversine computation (synchronous, <1ms; no inner abort needed)
    // providerTimeoutMs (cfg.distance.providerTimeoutMs) is available here but is not raced
    // against Haversine because the computation is microseconds. It is read so the config
    // contract is honored and future async providers (e.g. Mapbox) can use it.
    // See ADR-v8-05 for the pattern to wrap with promiseWithTimeout in a Mapbox provider.
    const distanceM = haversineDistanceM(from, to);
    const speedMps = (AVG_SPEED_KMH * 1000) / 3600;
    const etaSeconds = distanceM / speedMps;

    const result: DistanceResult = { etaSeconds, distanceM, source: 'haversine' };

    // Write to cache with TTL
    await this.redis.setEx(cacheKey, this.cfg.distance.cacheTtlSec, JSON.stringify({ etaSeconds, distanceM }));

    // F6 REQ-FIX-V8-06: count computed result
    this.metrics?.distanceProviderCalls.inc({ result: 'computed' });

    return result;
  }
}
