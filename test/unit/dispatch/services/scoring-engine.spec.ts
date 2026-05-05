import { ScoringEngine } from '../../../../src/dispatch/domain/services/scoring-engine';
import { IDistanceProvider, DistanceResult } from '../../../../src/common/interfaces/IDistanceProvider';
import { DispatchConfig, loadDispatchConfig } from '../../../../src/common/config/dispatch.config';
import { GeoPoint } from '../../../../src/dispatch/domain/value-objects/geo-point.vo';
import { VehicleCandidate } from '../../../../src/dispatch/domain/entities/vehicle-candidate';
import { SafePointCandidate } from '../../../../src/dispatch/domain/entities/safe-point-candidate';
import { Score } from '../../../../src/dispatch/domain/value-objects/score.vo';

// Shared GeoPoint for "same location" (origin = vehicle location → ETA = 0)
const origin = GeoPoint.of(4.65, -74.05);
const nearVehicleLoc = GeoPoint.of(4.65, -74.05); // same as origin → ETA=0 in mock
const farVehicleLoc = GeoPoint.of(4.7, -74.1);

function makeVehicle(overrides: Partial<ConstructorParameters<typeof VehicleCandidate>[0]> = {}): VehicleCandidate {
  return new VehicleCandidate({
    id: 'VH-001',
    location: nearVehicleLoc,
    batteryPct: 80,
    autonomyKm: 150,
    eligibility: 'eligible',
    state: 'available',
    telemetryAt: new Date(),
    ...overrides,
  });
}

function makeSafePoint(safetyValue: number, loc?: GeoPoint): SafePointCandidate {
  return new SafePointCandidate({
    id: 'SP-001',
    location: loc ?? GeoPoint.of(4.6501, -74.0499),
    safetyScore: Score.of(safetyValue),
    name: 'Test Point',
    zoneId: 'zone-1',
  });
}

function makeDistanceProvider(etaSeconds: number, source: 'cache' | 'haversine' = 'haversine'): IDistanceProvider {
  return {
    getEtaSeconds: jest.fn().mockResolvedValue({
      etaSeconds,
      distanceM: etaSeconds * 8.33, // approximate
      source,
    } satisfies DistanceResult),
  };
}

function makeConfig(overrides: Partial<DispatchConfig> = {}): DispatchConfig {
  return {
    ...loadDispatchConfig({}),
    ...overrides,
  };
}

describe('ScoringEngine', () => {
  // Test 1: ETA = 0 → proximity = 1
  it('computes proximity=1 when ETA is 0', async () => {
    const cfg = makeConfig();
    const provider = makeDistanceProvider(0);
    const engine = new ScoringEngine(provider, cfg);
    const vehicle = makeVehicle();
    const result = await engine.score({
      origin,
      vehicle,
      safePoint: null,
      tripDistanceKm: 5,
      zoneFactor: 0.5,
    });
    expect(result.proximity).toBe(1);
  });

  // Test 2: ETA = maxEtaSeconds → proximity = 0
  it('computes proximity=0 when ETA equals maxEtaSeconds', async () => {
    const cfg = makeConfig({ maxEtaSeconds: 600 });
    const provider = makeDistanceProvider(600);
    const engine = new ScoringEngine(provider, cfg);
    const vehicle = makeVehicle({ location: farVehicleLoc });
    const result = await engine.score({
      origin,
      vehicle,
      safePoint: null,
      tripDistanceKm: 5,
      zoneFactor: 0.5,
    });
    expect(result.proximity).toBe(0);
  });

  // Test 3: Vehicle autonomy exactly = requiredKm × (1 + reservePct/100) → energy = 1
  it('computes energy=1 when autonomy exactly covers required + reserve', async () => {
    const cfg = makeConfig(); // minimumReservePct = 0.15 → factor = 1.15
    const provider = makeDistanceProvider(0);
    const engine = new ScoringEngine(provider, cfg);
    const tripDistanceKm = 10;
    // From design §3: reserve_pct = 0.15 → energy = clamp01(available_range_km / (required_km * (1 + reserve_pct)))
    // minimumReservePct in config is 0.15 (fraction, not percentage): factor = 1 + 0.15 = 1.15
    const actualFactor = 1 + cfg.fleet.minimumReservePct; // 1 + 0.15 = 1.15
    const autonomy = tripDistanceKm * actualFactor; // 11.5 km → energy = 1
    const vehicle = makeVehicle({ autonomyKm: autonomy });
    const result = await engine.score({
      origin,
      vehicle,
      safePoint: null,
      tripDistanceKm,
      zoneFactor: 0.5,
    });
    expect(result.energy).toBeCloseTo(1.0, 6);
  });

  // Test 4: Vehicle below reserve → energy < 1
  it('computes energy<1 when vehicle autonomy is below required+reserve', async () => {
    const cfg = makeConfig();
    const provider = makeDistanceProvider(0);
    const engine = new ScoringEngine(provider, cfg);
    const tripDistanceKm = 10;
    const vehicle = makeVehicle({ autonomyKm: 5 }); // far below required
    const result = await engine.score({
      origin,
      vehicle,
      safePoint: null,
      tripDistanceKm,
      zoneFactor: 0.5,
    });
    expect(result.energy).toBeLessThan(1);
  });

  // Test 5: SafePoint absent → safety = 0.30 baseline
  it('uses originalSafetyBaseline=0.30 when no safe point given', async () => {
    const cfg = makeConfig({ originalSafetyBaseline: 0.3 });
    const provider = makeDistanceProvider(0);
    const engine = new ScoringEngine(provider, cfg);
    const result = await engine.score({
      origin,
      vehicle: makeVehicle(),
      safePoint: null,
      tripDistanceKm: 5,
      zoneFactor: 0.5,
    });
    expect(result.safety).toBe(0.3);
  });

  // Test 6: SafePoint with 0.8 → safety = 0.8
  it('uses safe point safetyScore when a safe point is provided', async () => {
    const cfg = makeConfig();
    const provider = makeDistanceProvider(0);
    const engine = new ScoringEngine(provider, cfg);
    const sp = makeSafePoint(0.8);
    const result = await engine.score({
      origin,
      vehicle: makeVehicle(),
      safePoint: sp,
      tripDistanceKm: 5,
      zoneFactor: 0.5,
    });
    expect(result.safety).toBeCloseTo(0.8, 6);
  });

  // Test 7: Composite total computed with weights from config
  it('computes total as weighted sum of all four components', async () => {
    const cfg = makeConfig();
    const provider = makeDistanceProvider(0); // proximity = 1
    const engine = new ScoringEngine(provider, cfg);
    const tripDistanceKm = 5;
    const zoneFactor = 0.5;
    const sp = makeSafePoint(0.8);
    const vehicle = makeVehicle({ autonomyKm: 100, batteryPct: 80 });

    const result = await engine.score({ origin, vehicle, safePoint: sp, tripDistanceKm, zoneFactor });

    // proximity=1, energy=clamp(100/(5*1.15))=1, safety=0.8
    // projectedBatteryPct = 80 - (5/100)*100 = 75
    // continuity = 0.7*clamp(75/100) + 0.3*0.5 = 0.7*0.75 + 0.15 = 0.525+0.15=0.675
    const expectedProximity = 1;
    const expectedEnergy = Math.min(1, vehicle.autonomyKm / (tripDistanceKm * (1 + cfg.fleet.minimumReservePct)));
    const expectedSafety = 0.8;
    const projectedBatteryPct = vehicle.batteryPct - (tripDistanceKm / vehicle.autonomyKm) * 100;
    const expectedContinuity = 0.7 * Math.min(1, Math.max(0, projectedBatteryPct / 100)) + 0.3 * zoneFactor;
    const expectedTotal =
      cfg.weights.proximity * expectedProximity +
      cfg.weights.energy * expectedEnergy +
      cfg.weights.safety * expectedSafety +
      cfg.weights.continuity * expectedContinuity;

    expect(result.total).toBeCloseTo(expectedTotal, 6);
    expect(result.proximity).toBeCloseTo(expectedProximity, 6);
    expect(result.energy).toBeCloseTo(expectedEnergy, 6);
    expect(result.safety).toBeCloseTo(expectedSafety, 6);
    expect(result.continuity).toBeCloseTo(expectedContinuity, 6);
  });

  // Test 8: Score function is deterministic for equivalent inputs
  it('returns identical total for two equivalent input calls (deterministic)', async () => {
    const cfg = makeConfig();
    const provider1 = makeDistanceProvider(120);
    const provider2 = makeDistanceProvider(120);
    const engine1 = new ScoringEngine(provider1, cfg);
    const engine2 = new ScoringEngine(provider2, cfg);
    const vehicle1 = makeVehicle({ id: 'VH-A' });
    const vehicle2 = makeVehicle({ id: 'VH-B' }); // same props, different id
    const sp = makeSafePoint(0.6);

    const input = { origin, safePoint: sp, tripDistanceKm: 8, zoneFactor: 0.7 };
    const r1 = await engine1.score({ ...input, vehicle: vehicle1 });
    const r2 = await engine2.score({ ...input, vehicle: vehicle2 });

    expect(r1.total).toBeCloseTo(r2.total, 9);
  });

  // Test 9: Walking distance computed via Haversine on safePoint coords
  it('computes walkingMeters via Haversine between origin and safePoint location', async () => {
    const cfg = makeConfig();
    const provider = makeDistanceProvider(0);
    const engine = new ScoringEngine(provider, cfg);

    // A safe point at a known offset from origin
    const spLoc = GeoPoint.of(4.6509, -74.05); // ~100m north
    const sp = makeSafePoint(0.7, spLoc);

    const result = await engine.score({
      origin,
      vehicle: makeVehicle(),
      safePoint: sp,
      tripDistanceKm: 5,
      zoneFactor: 0.5,
    });

    const expectedWalkingM = origin.distanceKmHaversine(spLoc) * 1000;
    expect(result.walkingMeters).toBeCloseTo(expectedWalkingM, 1);
    expect(result.walkingMeters).toBeGreaterThan(0);
  });

  // Test: walkingMeters=0 when no safe point
  it('returns walkingMeters=0 when no safe point provided', async () => {
    const cfg = makeConfig();
    const provider = makeDistanceProvider(0);
    const engine = new ScoringEngine(provider, cfg);
    const result = await engine.score({
      origin,
      vehicle: makeVehicle(),
      safePoint: null,
      tripDistanceKm: 5,
      zoneFactor: 0.5,
    });
    expect(result.walkingMeters).toBe(0);
  });

  // Test: etaSeconds is forwarded from distance provider
  it('populates etaSeconds from the distance provider result', async () => {
    const cfg = makeConfig();
    const provider = makeDistanceProvider(240);
    const engine = new ScoringEngine(provider, cfg);
    const result = await engine.score({
      origin,
      vehicle: makeVehicle(),
      safePoint: null,
      tripDistanceKm: 5,
      zoneFactor: 0.5,
    });
    expect(result.etaSeconds).toBe(240);
  });
});
