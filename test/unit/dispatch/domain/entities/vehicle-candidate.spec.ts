import { GeoPoint } from '@dispatch/domain/value-objects/geo-point.vo';
import { VehicleCandidate } from '@dispatch/domain/entities/vehicle-candidate';

describe('VehicleCandidate entity', () => {
  const location = GeoPoint.of(4.65, -74.05);

  it('creates a candidate with all required fields', () => {
    const candidate = new VehicleCandidate({
      id: 'VH-001',
      location,
      batteryPct: 80,
      autonomyKm: 120,
      eligibility: 'eligible',
      state: 'available',
      telemetryAt: new Date(),
    });

    expect(candidate.id).toBe('VH-001');
    expect(candidate.batteryPct).toBe(80);
    expect(candidate.autonomyKm).toBe(120);
    expect(candidate.eligibility).toBe('eligible');
    expect(candidate.state).toBe('available');
  });

  it('allows not_eligible state', () => {
    const candidate = new VehicleCandidate({
      id: 'VH-002',
      location,
      batteryPct: 50,
      autonomyKm: 80,
      eligibility: 'not_eligible',
      state: 'available',
      telemetryAt: new Date(),
    });
    expect(candidate.eligibility).toBe('not_eligible');
  });

  it('allows out_of_service state', () => {
    const candidate = new VehicleCandidate({
      id: 'VH-003',
      location,
      batteryPct: 50,
      autonomyKm: 80,
      eligibility: 'eligible',
      state: 'out_of_service',
      telemetryAt: new Date(),
    });
    expect(candidate.state).toBe('out_of_service');
  });
});
