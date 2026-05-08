import type Redis from 'ioredis';
import type { RedisClientLike } from '../providers/haversine-distance.provider';

/**
 * IoredisDistanceCacheAdapter — wraps ioredis to satisfy RedisClientLike.
 *
 * Judgment 14° F1: dispatch.module.ts previously injected a no-op stub
 * (`{ get: ()=>null, setEx: ()=>'OK' }`) for the distance cache, which
 * silently invalidated NFR-09 cache tier and DD-02 §8 (three degradation
 * levels). This adapter wires the existing ioredis dependency into the
 * provider so cache hits are real in production.
 */
export class IoredisDistanceCacheAdapter implements RedisClientLike {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setEx(key: string, ttlSec: number, value: string): Promise<unknown> {
    return this.client.setex(key, ttlSec, value);
  }
}
