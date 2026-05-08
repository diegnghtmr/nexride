import { CandidateFilter } from '@dispatch/domain/services/candidate-filter';
import { GeoPoint } from '@dispatch/domain/value-objects/geo-point.vo';
import { VehicleCandidate } from '@dispatch/domain/entities/vehicle-candidate';
import { loadDispatchConfig } from '@common/config/dispatch.config';

const cfg = loadDispatchConfig(process.env);
// reservePct=0.15, telemetryStalenessSec=60

const NOW = new Date('2026-05-04T12:00:00.000Z');

const makeVehicle = (
  overrides: Partial<{
    id: string;
    batteryPct: number;
    autonomyKm: number;
    eligibility: 'eligible' | 'not_eligible';
    state: 'available' | 'busy' | 'out_of_service';
    telemetryAt: Date;
    distanceFromOriginM: number;
  }>,
): VehicleCandidate =>
  new VehicleCandidate({
    id: overrides.id ?? 'VH-001',
    location: GeoPoint.of(4.65, -74.05),
    batteryPct: overrides.batteryPct ?? 80,
    autonomyKm: overrides.autonomyKm ?? 120,
    eligibility: overrides.eligibility ?? 'eligible',
    state: overrides.state ?? 'available',
    telemetryAt: overrides.telemetryAt ?? NOW,
    distanceFromOriginM: overrides.distanceFromOriginM ?? 0,
  });

describe('CandidateFilter', () => {
  describe('battery boundary tests', () => {
    // requiredKm=100, reserve=15% → threshold = 100 * (1+0.15) = 115 km
    // autonomyKm exactly 115 → passes (inclusive boundary)
    it('passes vehicle whose autonomy equals requiredKm × (1 + reservePct) exactly', () => {
      const requiredKm = 100;
      const threshold = requiredKm * (1 + cfg.fleet.minimumReservePct); // 115
      const vehicle = makeVehicle({ autonomyKm: threshold, telemetryAt: NOW });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed, rejections } = filter.filter([vehicle], requiredKm);

      expect(passed).toHaveLength(1);
      expect(rejections).toHaveLength(0);
    });

    it('rejects vehicle whose autonomy is one unit below the required threshold', () => {
      const requiredKm = 100;
      const threshold = requiredKm * (1 + cfg.fleet.minimumReservePct); // 115
      const vehicle = makeVehicle({ autonomyKm: threshold - 0.001, telemetryAt: NOW });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed, rejections } = filter.filter([vehicle], requiredKm);

      expect(passed).toHaveLength(0);
      expect(rejections[0].reason).toBe('insufficient_battery');
    });
  });

  describe('eligibility tests', () => {
    it('passes eligible vehicle', () => {
      const vehicle = makeVehicle({ eligibility: 'eligible', telemetryAt: NOW });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed } = filter.filter([vehicle], 50);
      expect(passed).toHaveLength(1);
    });

    it('rejects not_eligible vehicle regardless of battery', () => {
      const vehicle = makeVehicle({ eligibility: 'not_eligible', autonomyKm: 9999, telemetryAt: NOW });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed, rejections } = filter.filter([vehicle], 50);

      expect(passed).toHaveLength(0);
      expect(rejections[0].reason).toBe('not_eligible');
    });
  });

  describe('telemetry staleness tests', () => {
    // telemetryStalenessSec=60 → AT 60s = stale (inclusive)
    it('rejects vehicle whose telemetry is exactly 60 seconds old (boundary: inclusive stale)', () => {
      const telemetryAt = new Date(NOW.getTime() - 60_000); // exactly 60s ago
      const vehicle = makeVehicle({ telemetryAt });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed, rejections } = filter.filter([vehicle], 50);

      expect(passed).toHaveLength(0);
      expect(rejections[0].reason).toBe('stale_telemetry');
    });

    it('accepts vehicle whose telemetry is 59 seconds old (fresh)', () => {
      const telemetryAt = new Date(NOW.getTime() - 59_000); // 59s ago
      const vehicle = makeVehicle({ telemetryAt });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed } = filter.filter([vehicle], 50);

      expect(passed).toHaveLength(1);
    });
  });

  describe('operational state tests', () => {
    it('rejects out_of_service vehicle even with excellent battery and fresh telemetry', () => {
      const vehicle = makeVehicle({
        state: 'out_of_service',
        batteryPct: 100,
        autonomyKm: 9999,
        telemetryAt: NOW,
      });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed, rejections } = filter.filter([vehicle], 50);

      expect(passed).toHaveLength(0);
      expect(rejections[0].reason).toBe('out_of_service');
    });

    // Judgment 19° F4 — busy vehicles must be rejected (parity with
    // fallback-handler:31 which already filters them). Without this,
    // a vehicle on an active trip enters scoring and could be re-dispatched.
    it('rejects busy vehicle even with excellent battery and fresh telemetry', () => {
      const vehicle = makeVehicle({
        state: 'busy',
        batteryPct: 100,
        autonomyKm: 9999,
        telemetryAt: NOW,
      });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed, rejections } = filter.filter([vehicle], 50);

      expect(passed).toHaveLength(0);
      expect(rejections[0].reason).toBe('busy');
    });
  });

  describe('autonomy threshold includes vehicle-to-pickup distance (F2)', () => {
    // autonomyKm=115, distanceFromOriginM=5000 (5km to pickup), trip=100km, reserve=15%
    // Correct threshold: (100 + 5) * 1.15 = 120.75 > 115 → REJECTED
    it('rejects vehicle when trip + vehicle-to-pickup distance together exceed autonomy (F2)', () => {
      const vehicle = new VehicleCandidate({
        id: 'VH-F2',
        location: GeoPoint.of(4.65, -74.05),
        batteryPct: 75,
        autonomyKm: 115,
        eligibility: 'eligible',
        state: 'available',
        telemetryAt: NOW,
        distanceFromOriginM: 5000,
      });
      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed, rejections } = filter.filter([vehicle], 100);

      expect(passed).toHaveLength(0);
      expect(rejections[0].reason).toBe('insufficient_battery');
    });
  });

  describe('mixed batch', () => {
    it('correctly partitions a mixed batch of 4 vehicles', () => {
      const good = makeVehicle({ id: 'VH-good', autonomyKm: 200, telemetryAt: NOW });
      const outOfService = makeVehicle({ id: 'VH-oos', state: 'out_of_service', telemetryAt: NOW });
      const ineligible = makeVehicle({ id: 'VH-inelig', eligibility: 'not_eligible', telemetryAt: NOW });
      const stale = makeVehicle({ id: 'VH-stale', telemetryAt: new Date(NOW.getTime() - 60_000) });

      const filter = new CandidateFilter(cfg, () => NOW);
      const { passed, rejections } = filter.filter([good, outOfService, ineligible, stale], 50);

      expect(passed).toHaveLength(1);
      expect(passed[0].id).toBe('VH-good');
      expect(rejections).toHaveLength(3);
    });
  });
});
