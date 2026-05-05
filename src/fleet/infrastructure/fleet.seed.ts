/**
 * Fleet seed helper — populates Redis with sample vehicle data.
 * Used in tests and local development (npm run dev:seed).
 *
 * Usage:
 *   import { seedFleet } from './fleet.seed';
 *   await seedFleet(redis, vehicles);
 */
import type Redis from 'ioredis';

export interface SeedVehicle {
  id: string;
  lat: number;
  lng: number;
  batteryPct: number;
  eligible: boolean;
  state: 'in_service' | 'out_of_service' | 'available';
  rangeKm: number;
  snapshotAt?: Date;
}

export async function seedFleet(redis: Redis, vehicles: SeedVehicle[]): Promise<void> {
  // Clear existing data
  await redis.del('fleet:geo');
  for (const v of vehicles) {
    await redis.del(`fleet:vehicles:${v.id}`);
  }

  if (vehicles.length === 0) return;

  // GEOADD fleet:geo lng lat memberId ...
  const geoArgs: Array<string | number> = ['fleet:geo'];
  for (const v of vehicles) {
    geoArgs.push(v.lng, v.lat, v.id);
  }
  await (redis.geoadd as (...args: unknown[]) => Promise<unknown>)(...geoArgs);

  // HSET fleet:vehicles:{id}
  for (const v of vehicles) {
    await redis.hset(`fleet:vehicles:${v.id}`, {
      battery_pct: String(v.batteryPct),
      eligible: v.eligible ? '1' : '0',
      state: v.state,
      range_km: String(v.rangeKm),
      snapshot_at: (v.snapshotAt ?? new Date()).toISOString(),
    });
  }
}

/**
 * Default sample data for local development.
 */
export const DEFAULT_VEHICLES: SeedVehicle[] = [
  {
    id: 'VH-001',
    lat: 4.651,
    lng: -74.051,
    batteryPct: 80,
    eligible: true,
    state: 'in_service',
    rangeKm: 80,
  },
  {
    id: 'VH-002',
    lat: 4.652,
    lng: -74.052,
    batteryPct: 60,
    eligible: true,
    state: 'in_service',
    rangeKm: 60,
  },
  {
    id: 'VH-003',
    lat: 4.653,
    lng: -74.053,
    batteryPct: 45,
    eligible: true,
    state: 'in_service',
    rangeKm: 45,
  },
];
