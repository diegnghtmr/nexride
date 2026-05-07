/**
 * Unit tests for FleetService
 *
 * Strict TDD: written before implementation (RED phase), then made GREEN.
 * RedisFleetAdapter is fully mocked — no Redis I/O.
 *
 * 5 scenarios (exceeds minimum of 4):
 * 1. vehicle outside radius excluded
 * 2. battery exact reserve passes (eligible=true)
 * 3. battery below reserve filtered by CandidateFilter (downstream) — FleetService
 *    returns ALL vehicles in radius; filtering is done in dispatch domain.
 *    This test ensures eligible=false vehicle is still returned (filter is separate).
 * 4. telemetry exactly at 60s → stale (per spec EH risk #1: stale AT 60s, exclusive freshness)
 * 5. telemetry 59s old → NOT stale
 */

import { ConfigService } from '@nestjs/config';
import { FleetService } from '../../../src/fleet/fleet.service';
import { RedisFleetAdapter } from '../../../src/fleet/infrastructure/redis-fleet.adapter';

function makeAdapter(): jest.Mocked<Pick<RedisFleetAdapter, 'getVehicleIdsInRadius' | 'getVehicleHash'>> {
  return {
    getVehicleIdsInRadius: jest.fn(),
    getVehicleHash: jest.fn(),
  };
}

function makeConfigService(staleness = 60): jest.Mocked<ConfigService> {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'FLEET_TELEMETRY_STALENESS_SEC') return staleness;
      return undefined;
    }),
  } as unknown as jest.Mocked<ConfigService>;
}

describe('FleetService', () => {
  let service: FleetService;
  let adapter: ReturnType<typeof makeAdapter>;

  beforeEach(() => {
    adapter = makeAdapter();
    service = new FleetService(adapter as unknown as RedisFleetAdapter, makeConfigService(60));
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('findCandidatesInRadius()', () => {
    it('1. vehicle outside radius excluded — adapter returns empty, service returns empty', async () => {
      adapter.getVehicleIdsInRadius.mockResolvedValue(
        [] as Array<{ id: string; distanceM: number; location: { lat: number; lng: number } }>,
      );

      const result = await service.findCandidatesInRadius({ lat: 4.65, lng: -74.05 }, 5);

      expect(result).toHaveLength(0);
    });

    it('2. vehicle with eligible=1 is included in candidates', async () => {
      const now = Date.now();
      jest.setSystemTime(now);

      adapter.getVehicleIdsInRadius.mockResolvedValue([
        { id: 'VH-001', distanceM: 200, location: { lat: 4.651, lng: -74.051 } },
      ]);
      adapter.getVehicleHash.mockResolvedValue({
        battery_pct: '80',
        eligible: '1',
        state: 'in_service',
        range_km: '80',
        snapshot_at: new Date(now - 10_000).toISOString(), // 10s ago — fresh
      });

      const result = await service.findCandidatesInRadius({ lat: 4.65, lng: -74.05 }, 5);

      expect(result).toHaveLength(1);
      expect(result[0].eligible).toBe(true);
      expect(result[0].batteryLevelPct).toBe(80);
      expect(result[0].location).toEqual({ lat: 4.651, lng: -74.051 });
    });

    it('3. eligible=0 vehicle is returned (filtering is a dispatch domain concern)', async () => {
      const now = Date.now();
      jest.setSystemTime(now);

      adapter.getVehicleIdsInRadius.mockResolvedValue([
        { id: 'VH-002', distanceM: 300, location: { lat: 4.652, lng: -74.052 } },
      ]);
      adapter.getVehicleHash.mockResolvedValue({
        battery_pct: '15',
        eligible: '0',
        state: 'in_service',
        range_km: '15',
        snapshot_at: new Date(now - 5_000).toISOString(),
      });

      const result = await service.findCandidatesInRadius({ lat: 4.65, lng: -74.05 }, 5);

      // FleetService does NOT filter — it returns the raw snapshot; dispatch filter does filtering
      expect(result).toHaveLength(1);
      expect(result[0].eligible).toBe(false);
    });
  });

  describe('getVehicleSnapshot()', () => {
    it('4. telemetry exactly at 60s → stale (exclusive freshness boundary)', async () => {
      const now = Date.now();
      jest.setSystemTime(now);

      // Exactly 60 seconds ago = stale (ageSeconds >= stalenessSec)
      const snapshotAt = new Date(now - 60_000).toISOString();
      adapter.getVehicleHash.mockResolvedValue({
        battery_pct: '70',
        eligible: '1',
        state: 'in_service',
        range_km: '70',
        snapshot_at: snapshotAt,
      });

      const snapshot = await service.getVehicleSnapshot('VH-001');

      expect(snapshot).not.toBeNull();
      expect(snapshot!.telemetryStale).toBe(true);
    });

    it('5. telemetry 59s old → NOT stale (within freshness window)', async () => {
      const now = Date.now();
      jest.setSystemTime(now);

      const snapshotAt = new Date(now - 59_000).toISOString();
      adapter.getVehicleHash.mockResolvedValue({
        battery_pct: '70',
        eligible: '1',
        state: 'in_service',
        range_km: '70',
        snapshot_at: snapshotAt,
      });

      const snapshot = await service.getVehicleSnapshot('VH-001');

      expect(snapshot).not.toBeNull();
      expect(snapshot!.telemetryStale).toBe(false);
    });
  });
});
