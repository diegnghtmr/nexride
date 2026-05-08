/**
 * Unit tests for IoredisDistanceCacheAdapter — wraps ioredis to satisfy
 * RedisClientLike. Reason: dispatch.module.ts injected a no-op stub for
 * the distance cache (judgment 14° F1), so NFR-09 cache tier never fired
 * in production. This adapter is the wire to a real Redis.
 */

import { IoredisDistanceCacheAdapter } from '../../../../src/dispatch/infrastructure/cache/ioredis-distance-cache.adapter';

interface FakeIoredis {
  get: jest.Mock<Promise<string | null>, [string]>;
  setex: jest.Mock<Promise<'OK'>, [string, number, string]>;
}

describe('IoredisDistanceCacheAdapter', () => {
  let fake: FakeIoredis;
  let adapter: IoredisDistanceCacheAdapter;

  beforeEach(() => {
    fake = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    adapter = new IoredisDistanceCacheAdapter(
      fake as unknown as ConstructorParameters<typeof IoredisDistanceCacheAdapter>[0],
    );
  });

  it('forwards get(key) to underlying ioredis.get', async () => {
    fake.get.mockResolvedValueOnce('{"etaSeconds":120,"distanceM":833}');
    const result = await adapter.get('distance:1:2:3:4');
    expect(fake.get).toHaveBeenCalledWith('distance:1:2:3:4');
    expect(result).toBe('{"etaSeconds":120,"distanceM":833}');
  });

  it('returns null on cache miss', async () => {
    const result = await adapter.get('distance:miss');
    expect(result).toBeNull();
  });

  it('forwards setEx(key, ttlSec, value) to ioredis.setex preserving TTL', async () => {
    await adapter.setEx('distance:k', 60, '{"etaSeconds":99,"distanceM":700}');
    expect(fake.setex).toHaveBeenCalledWith('distance:k', 60, '{"etaSeconds":99,"distanceM":700}');
  });
});
