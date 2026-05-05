import { CandidateGenerator } from '@dispatch/domain/services/candidate-generator';
import { GeoPoint } from '@dispatch/domain/value-objects/geo-point.vo';
import { IFleetService } from '@common/interfaces/IFleetService';
import { ISafePointsService } from '@common/interfaces/ISafePointsService';
import { loadDispatchConfig } from '@common/config/dispatch.config';
import {
  VehicleCandidate as SharedVehicleCandidate,
  SafePoint as SharedSafePoint,
} from '@common/interfaces/shared-types';

const NOW_MS = Date.now();

const makeSharedVehicle = (id: string): SharedVehicleCandidate => ({
  id,
  location: { lat: 4.65, lng: -74.05 },
  batteryLevelPct: 80,
  rangeKm: 120,
  eligible: true,
  status: 'available',
  lastTelemetryAt: NOW_MS,
  telemetryStale: false,
  distanceFromOriginM: 300,
});

const makeSharedSafePoint = (id: string): SharedSafePoint => ({
  id,
  name: `SP-${id}`,
  location: { lat: 4.651, lng: -74.051 },
  zoneId: 'zone-1',
  reason: 'test',
  safetyScore: 0.85,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('CandidateGenerator', () => {
  const origin = GeoPoint.of(4.65, -74.05);
  const cfg = loadDispatchConfig(process.env);

  it('returns vehicles and safe points in parallel when both succeed', async () => {
    const sharedVehicles = [makeSharedVehicle('VH-1'), makeSharedVehicle('VH-2'), makeSharedVehicle('VH-3')];
    const sharedSafePoints = [makeSharedSafePoint('SP-1'), makeSharedSafePoint('SP-2')];

    const fleetSvc: jest.Mocked<IFleetService> = {
      findCandidatesInRadius: jest.fn().mockResolvedValue(sharedVehicles),
      getVehicleSnapshot: jest.fn(),
    };
    const safePointsSvc: jest.Mocked<ISafePointsService> = {
      findWithin: jest.fn().mockResolvedValue(sharedSafePoints),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
      delete: jest.fn(),
    };

    const generator = new CandidateGenerator(fleetSvc, safePointsSvc, cfg);
    const result = await generator.generate(origin);

    expect(result.vehicles).toHaveLength(3);
    expect(result.safePoints).toHaveLength(2);
    // verify domain VOs are produced (not raw shared types)
    expect(result.vehicles[0].id).toBe('VH-1');
    expect(result.vehicles[0].eligibility).toBe('eligible');
    expect(result.safePoints[0].safetyScore.value).toBe(0.85);
    expect(fleetSvc.findCandidatesInRadius).toHaveBeenCalledWith(origin, cfg.candidateRadiusKm);
    expect(safePointsSvc.findWithin).toHaveBeenCalledWith(origin, cfg.safePointRadiusM);
  });

  it('propagates error when fleet service rejects', async () => {
    const fleetSvc: jest.Mocked<IFleetService> = {
      findCandidatesInRadius: jest.fn().mockRejectedValue(new Error('Redis down')),
      getVehicleSnapshot: jest.fn(),
    };
    const safePointsSvc: jest.Mocked<ISafePointsService> = {
      findWithin: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
      delete: jest.fn(),
    };

    const generator = new CandidateGenerator(fleetSvc, safePointsSvc, cfg);
    await expect(generator.generate(origin)).rejects.toThrow('Redis down');
  });

  it('returns empty arrays when both services return no results', async () => {
    const fleetSvc: jest.Mocked<IFleetService> = {
      findCandidatesInRadius: jest.fn().mockResolvedValue([]),
      getVehicleSnapshot: jest.fn(),
    };
    const safePointsSvc: jest.Mocked<ISafePointsService> = {
      findWithin: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
      delete: jest.fn(),
    };

    const generator = new CandidateGenerator(fleetSvc, safePointsSvc, cfg);
    const result = await generator.generate(origin);

    expect(result.vehicles).toEqual([]);
    expect(result.safePoints).toEqual([]);
  });
});
