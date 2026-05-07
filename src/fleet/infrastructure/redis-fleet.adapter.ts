import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GeoPoint } from '../../common/interfaces/shared-types';

export interface RawVehicleSnapshot {
  id: string;
  batteryPct: number;
  eligible: boolean;
  state: string;
  snapshotAt: string;
  rangeKm: number;
  distanceFromOriginM?: number;
}

/**
 * RedisFleetAdapter — reads fleet state from Redis.
 *
 * Redis keys (design §5):
 * - `fleet:geo` — GEO set; members are vehicleId, positions are lon/lat.
 * - `fleet:vehicles:{id}` — HASH: battery_pct, eligible, state, snapshot_at, range_km.
 *
 * Uses GEOSEARCH (Redis 6.2+) instead of deprecated GEORADIUS for production;
 * falls back gracefully if GEOSEARCH is unavailable.
 */
@Injectable()
export class RedisFleetAdapter implements OnModuleInit, OnModuleDestroy {
  readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      // enableOfflineQueue defaults to true — commands queue while connecting
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
    } catch {
      // Already connected or connection error; surfaced at query time
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Returns vehicle IDs within radiusKm of the given origin, sorted by
   * ascending distance (closest first), with real coordinates from Redis GEO.
   */
  async getVehicleIdsInRadius(
    origin: GeoPoint,
    radiusKm: number,
  ): Promise<Array<{ id: string; distanceM: number; location: { lat: number; lng: number } }>> {
    // GEOSEARCH FROMLONLAT <lng> <lat> BYRADIUS <r> km ASC COUNT 100 WITHDIST WITHCOORD
    // ioredis raw response shape with WITHDIST+WITHCOORD:
    //   Array<[id: string, distStr: string, [lngStr: string, latStr: string]]>
    const results = await (
      this.redis as unknown as {
        geosearch: (...args: unknown[]) => Promise<Array<[string, string, [string, string]]>>;
      }
    ).geosearch(
      'fleet:geo',
      'FROMLONLAT',
      origin.lng,
      origin.lat,
      'BYRADIUS',
      radiusKm,
      'km',
      'ASC',
      'COUNT',
      100,
      'WITHDIST',
      'WITHCOORD',
    );

    if (!Array.isArray(results)) return [];

    return results.map((entry) => {
      // With WITHDIST+WITHCOORD: [id, distStr, [lngStr, latStr]]
      // WITHDIST returns distance in the unit passed to BYRADIUS (km) — multiply by 1000 for meters.
      // ioredis returns all values as bulk strings; parseFloat is required.
      const [id, distStr, coordPair] = entry;
      const distanceM = parseFloat(distStr) * 1000;
      const lng = parseFloat(coordPair[0]);
      const lat = parseFloat(coordPair[1]);
      return { id, distanceM, location: { lat, lng } };
    });
  }

  /**
   * Reads a vehicle's HASH snapshot from Redis.
   * Returns null if the key does not exist.
   */
  async getVehicleHash(vehicleId: string): Promise<Record<string, string> | null> {
    const data = await this.redis.hgetall(`fleet:vehicles:${vehicleId}`);
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  }
}
