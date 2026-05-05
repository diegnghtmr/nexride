import { HaversineDistanceProvider } from '../../../../src/dispatch/infrastructure/providers/haversine-distance.provider';
import { DispatchConfig, loadDispatchConfig } from '../../../../src/common/config/dispatch.config';
import { GeoPoint } from '../../../../src/dispatch/domain/value-objects/geo-point.vo';
import { DistanceProviderTimeoutError } from '../../../../src/common/errors/domain-error';

interface FakeRedisClient {
  get: jest.Mock;
  set: jest.Mock;
  setEx: jest.Mock;
}

function makeFakeRedis(): FakeRedisClient {
  return {
    get: jest.fn().mockResolvedValue(null), // cache miss by default
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
  };
}

function makeConfig(overrides: Partial<DispatchConfig> = {}): DispatchConfig {
  return {
    ...loadDispatchConfig({}),
    ...overrides,
  };
}

const origin = GeoPoint.of(4.65, -74.05);
const destination = GeoPoint.of(4.70, -74.10);

describe('HaversineDistanceProvider', () => {
  // Test 1: Cache miss → computes Haversine, writes to cache, returns 'haversine' source
  it('returns haversine result and caches it on cache miss', async () => {
    const redis = makeFakeRedis();
    const cfg = makeConfig();
    const provider = new HaversineDistanceProvider(redis, cfg);

    const result = await provider.getEtaSeconds(origin, destination);

    expect(result.source).toBe('haversine');
    expect(result.etaSeconds).toBeGreaterThan(0);
    expect(result.distanceM).toBeGreaterThan(0);
    expect(redis.setEx).toHaveBeenCalledTimes(1);
  });

  // Test 2: Cache hit → returns cached data with 'cache' source, no Redis write
  it('returns cached result with source=cache on cache hit', async () => {
    const redis = makeFakeRedis();
    const cachedData = JSON.stringify({ etaSeconds: 180, distanceM: 1250 });
    redis.get.mockResolvedValue(cachedData);

    const cfg = makeConfig();
    const provider = new HaversineDistanceProvider(redis, cfg);

    const result = await provider.getEtaSeconds(origin, destination);

    expect(result.source).toBe('cache');
    expect(result.etaSeconds).toBe(180);
    expect(result.distanceM).toBe(1250);
    expect(redis.setEx).not.toHaveBeenCalled();
  });

  // Test 3: Fault injection → throws DistanceProviderTimeoutError
  it('throws DistanceProviderTimeoutError when injectTimeout is true', async () => {
    const redis = makeFakeRedis();
    const cfg = makeConfig({ distance: { cacheTtlSec: 60, providerTimeoutMs: 800, injectTimeout: true } });
    const provider = new HaversineDistanceProvider(redis, cfg);

    await expect(provider.getEtaSeconds(origin, destination)).rejects.toThrow(DistanceProviderTimeoutError);
  });

  // Test 4: ETA derived from Haversine distance + default speed
  it('derives etaSeconds from Haversine distance using configured avgSpeedKmh', async () => {
    const redis = makeFakeRedis();
    const cfg = makeConfig();
    const provider = new HaversineDistanceProvider(redis, cfg);

    const result = await provider.getEtaSeconds(origin, destination);

    // Verify ETA is consistent with distance: etaSeconds ≈ distanceM / (speed_in_m_per_s)
    // At 25 km/h: speed_m_s = 25000 / 3600 ≈ 6.944
    const speedMps = 25000 / 3600;
    const expectedEta = result.distanceM / speedMps;
    expect(result.etaSeconds).toBeCloseTo(expectedEta, 0);
  });

  // Test 5: Cache key deterministic for same coordinates
  it('uses the same cache key for identical coordinate pairs', async () => {
    const redis = makeFakeRedis();
    const cfg = makeConfig();
    const provider = new HaversineDistanceProvider(redis, cfg);

    await provider.getEtaSeconds(origin, destination);
    await provider.getEtaSeconds(origin, destination);

    // Both calls read from the same key (first call misses, second should hit if we simulate it)
    const key1 = (redis.get as jest.Mock).mock.calls[0][0] as string;
    const key2 = (redis.get as jest.Mock).mock.calls[1][0] as string;
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^distance:/);
  });
});
