/**
 * Fleet Read Integration Tests
 *
 * Uses Testcontainers Redis 7 to boot a real Redis instance.
 * Seeds fleet:geo (GEOADD) and fleet:vehicles:{id} (HSET) before each scenario.
 *
 * Strict TDD: tests written BEFORE the implementation (RED phase).
 *
 * Scenarios:
 * 1. findCandidatesInRadius returns vehicles inside radius, sorted by distance
 * 2. findCandidatesInRadius excludes vehicles outside radius
 * 3. getVehicleSnapshot with stale snapshot_at (>60s) sets telemetryStale=true
 * 4. getVehicleSnapshot with fresh snapshot_at sets telemetryStale=false
 */

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { FleetModule } from '../../../src/fleet/fleet.module';
import { FleetService } from '../../../src/fleet/fleet.service';

const ORIGIN_LAT = 4.65;
const ORIGIN_LNG = -74.05;

// Vehicles: two inside 5km, one far outside
const VEHICLES = {
  inside1: {
    id: 'VH-001',
    lat: 4.651, // ~110m from origin
    lng: -74.051,
    battery_pct: '80',
    eligible: '1',
    state: 'in_service',
    range_km: '80',
  },
  inside2: {
    id: 'VH-002',
    lat: 4.652, // ~220m from origin
    lng: -74.052,
    battery_pct: '60',
    eligible: '1',
    state: 'in_service',
    range_km: '60',
  },
  outside: {
    id: 'VH-003',
    lat: 4.85, // ~22km from origin
    lng: -74.25,
    battery_pct: '90',
    eligible: '1',
    state: 'in_service',
    range_km: '90',
  },
};

describe('Fleet Read (integration)', () => {
  let redisContainer: StartedRedisContainer;
  let fleetService: FleetService;

  beforeAll(async () => {
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_URL: redisContainer.getConnectionUrl(),
              FLEET_TELEMETRY_STALENESS_SEC: '60',
            }),
          ],
        }),
        FleetModule,
      ],
    }).compile();

    fleetService = module.get<FleetService>(FleetService);
  }, 60_000);

  afterAll(async () => {
    await redisContainer?.stop();
  });

  async function seedFleet(
    vehicles: Array<{
      id: string;
      lat: number;
      lng: number;
      battery_pct: string;
      eligible: string;
      state: string;
      range_km: string;
      snapshot_at?: string;
    }>,
  ): Promise<void> {
    const service = fleetService as unknown as { redisAdapter: { redis: import('ioredis').Redis } };
    const redis = service.redisAdapter['redis'];

    // Clear previous data
    await redis.del('fleet:geo');
    for (const v of vehicles) {
      await redis.del(`fleet:vehicles:${v.id}`);
    }

    // GEOADD: members are vehicleId, lng/lat order for Redis GEO
    const geoArgs: Array<string | number> = ['fleet:geo'];
    for (const v of vehicles) {
      geoArgs.push(v.lng, v.lat, v.id);
    }
    await (redis.geoadd as (...args: unknown[]) => Promise<unknown>)(...geoArgs);

    // HSET fleet:vehicles:{id}
    const now = new Date();
    for (const v of vehicles) {
      const snapshotAt = v.snapshot_at ?? now.toISOString();
      await redis.hset(`fleet:vehicles:${v.id}`, {
        battery_pct: v.battery_pct,
        eligible: v.eligible,
        state: v.state,
        range_km: v.range_km,
        snapshot_at: snapshotAt,
      });
    }
  }

  describe('findCandidatesInRadius()', () => {
    it('returns vehicles inside 5km radius, sorted by proximity', async () => {
      await seedFleet([
        { ...VEHICLES.inside1, snapshot_at: new Date().toISOString() },
        { ...VEHICLES.inside2, snapshot_at: new Date().toISOString() },
        { ...VEHICLES.outside, snapshot_at: new Date().toISOString() },
      ]);

      const candidates = await fleetService.findCandidatesInRadius({ lat: ORIGIN_LAT, lng: ORIGIN_LNG }, 5);

      const ids = candidates.map((c) => c.id);
      expect(ids).toContain('VH-001');
      expect(ids).toContain('VH-002');
      expect(ids).not.toContain('VH-003');

      // F11: location must carry real Redis-seeded coordinates (non-zero)
      const vh001 = candidates.find((c) => c.id === 'VH-001');
      expect(vh001).toBeDefined();
      expect(vh001!.location.lat).not.toBe(0);
      expect(vh001!.location.lng).not.toBe(0);
    });

    it('excludes vehicle that is outside the radius', async () => {
      await seedFleet([{ ...VEHICLES.outside, snapshot_at: new Date().toISOString() }]);

      const candidates = await fleetService.findCandidatesInRadius({ lat: ORIGIN_LAT, lng: ORIGIN_LNG }, 5);

      expect(candidates).toHaveLength(0);
    });
  });

  describe('getVehicleSnapshot()', () => {
    it('stale snapshot_at (>60s old) sets telemetryStale=true', async () => {
      const staleAt = new Date(Date.now() - 61_000).toISOString(); // 61 seconds ago
      await seedFleet([{ ...VEHICLES.inside1, snapshot_at: staleAt }]);

      const snapshot = await fleetService.getVehicleSnapshot('VH-001');

      expect(snapshot).not.toBeNull();
      expect(snapshot!.telemetryStale).toBe(true);
    });

    it('fresh snapshot_at (<60s old) sets telemetryStale=false', async () => {
      const freshAt = new Date(Date.now() - 30_000).toISOString(); // 30 seconds ago
      await seedFleet([{ ...VEHICLES.inside1, snapshot_at: freshAt }]);

      const snapshot = await fleetService.getVehicleSnapshot('VH-001');

      expect(snapshot).not.toBeNull();
      expect(snapshot!.telemetryStale).toBe(false);
    });
  });
});
