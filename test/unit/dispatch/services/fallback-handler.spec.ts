import { FallbackHandler } from '../../../../src/dispatch/domain/services/fallback-handler';
import { IFleetService } from '../../../../src/common/interfaces/IFleetService';
import { loadDispatchConfig } from '../../../../src/common/config/dispatch.config';
import { GeoPoint } from '../../../../src/dispatch/domain/value-objects/geo-point.vo';
import { NoAvailabilityError } from '../../../../src/common/errors/domain-error';
import type { VehicleCandidate } from '../../../../src/common/interfaces/shared-types';

const origin = GeoPoint.of(4.65, -74.05);
const defaultCfg = loadDispatchConfig({});

function makeVehicleSnapshot(overrides: Partial<VehicleCandidate> = {}): VehicleCandidate {
  return {
    id: 'VH-001',
    batteryLevelPct: 80,
    eligible: true,
    status: 'available',
    lastTelemetryAt: Date.now(),
    rangeKm: 120,
    location: { lat: 4.651, lng: -74.051 },
    telemetryStale: false,
    distanceFromOriginM: 200,
    ...overrides,
  };
}

function makeFleetService(candidates: VehicleCandidate[]): IFleetService {
  return {
    findCandidatesInRadius: jest.fn().mockResolvedValue(candidates),
    getVehicleSnapshot: jest.fn(),
  };
}

describe('FallbackHandler', () => {
  // Test 1: Timeout fallback → returns nearest viable vehicle with battery ≥ 20%
  it('returns nearest viable vehicle with battery ≥ 20% on timeout fallback', async () => {
    const nearVehicle = makeVehicleSnapshot({
      id: 'VH-NEAR',
      batteryLevelPct: 50,
      distanceFromOriginM: 300,
      location: { lat: 4.652, lng: -74.052 },
    });
    const farVehicle = makeVehicleSnapshot({
      id: 'VH-FAR',
      batteryLevelPct: 60,
      distanceFromOriginM: 800,
      location: { lat: 4.66, lng: -74.06 },
    });
    const fleet = makeFleetService([farVehicle, nearVehicle]); // near is second in array
    const handler = new FallbackHandler(fleet, defaultCfg);

    const result = await handler.fallback(origin, 'timeout');

    expect(result.vehicleId).toBe('VH-NEAR');
    expect(result.fallbackReason).toBe('timeout');
    expect(result.fallbackDistanceKm).toBeGreaterThan(0);
  });

  // Test 2: No candidates → throws NoAvailabilityError
  it('throws NoAvailabilityError when no viable vehicle exists', async () => {
    const lowBatteryVehicle = makeVehicleSnapshot({
      id: 'VH-LOW',
      batteryLevelPct: 10, // below 20% threshold
    });
    const fleet = makeFleetService([lowBatteryVehicle]);
    const handler = new FallbackHandler(fleet, defaultCfg);

    await expect(handler.fallback(origin, 'no_candidates')).rejects.toThrow(NoAvailabilityError);
  });

  // Test 3: fallback_reason recorded in result
  it('records the fallback reason in the result', async () => {
    const vehicle = makeVehicleSnapshot({ id: 'VH-001', batteryLevelPct: 25 });
    const fleet = makeFleetService([vehicle]);
    const handler = new FallbackHandler(fleet, defaultCfg);

    const result = await handler.fallback(origin, 'distance_unavailable');

    expect(result.fallbackReason).toBe('distance_unavailable');
  });

  // Test 4: Filters out ineligible vehicles in fallback mode
  it('ignores ineligible vehicles even in fallback mode', async () => {
    const ineligibleVehicle = makeVehicleSnapshot({ id: 'VH-BAD', batteryLevelPct: 80, eligible: false });
    const eligibleVehicle = makeVehicleSnapshot({ id: 'VH-GOOD', batteryLevelPct: 30, eligible: true });
    const fleet = makeFleetService([ineligibleVehicle, eligibleVehicle]);
    const handler = new FallbackHandler(fleet, defaultCfg);

    const result = await handler.fallback(origin, 'timeout');
    expect(result.vehicleId).toBe('VH-GOOD');
  });

  // Test 5: Filters out non-available vehicles
  it('ignores non-available vehicles in fallback mode', async () => {
    const busyVehicle = makeVehicleSnapshot({ id: 'VH-BUSY', batteryLevelPct: 80, status: 'in_service' });
    const availableVehicle = makeVehicleSnapshot({ id: 'VH-FREE', batteryLevelPct: 30, status: 'available' });
    const fleet = makeFleetService([busyVehicle, availableVehicle]);
    const handler = new FallbackHandler(fleet, defaultCfg);

    const result = await handler.fallback(origin, 'timeout');
    expect(result.vehicleId).toBe('VH-FREE');
  });
});
