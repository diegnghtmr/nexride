import type { OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import type { RedisClientLike } from '../providers/haversine-distance.provider';

/**
 * IoredisDistanceCacheAdapter — wraps ioredis to satisfy RedisClientLike.
 *
 * Judgment 14° F1: replaces the no-op stub previously injected into
 * HaversineDistanceProvider, restoring NFR-09 cache tier and DD-02 §8.
 *
 * Judgment 15° F4: implements OnModuleDestroy so the underlying ioredis
 * client is closed on shutdown / hot-reload — previously the connection
 * leaked because the factory created the client without lifecycle.
 */
export class IoredisDistanceCacheAdapter implements RedisClientLike, OnModuleDestroy {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setEx(key: string, ttlSec: number, value: string): Promise<unknown> {
    return this.client.setex(key, ttlSec, value);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
