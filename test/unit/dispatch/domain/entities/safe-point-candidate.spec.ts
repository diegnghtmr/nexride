import { GeoPoint } from '@dispatch/domain/value-objects/geo-point.vo';
import { Score } from '@dispatch/domain/value-objects/score.vo';
import { SafePointCandidate } from '@dispatch/domain/entities/safe-point-candidate';

describe('SafePointCandidate entity', () => {
  it('creates a safe-point candidate with all required fields', () => {
    const location = GeoPoint.of(4.6502, -74.0498);
    const safetyScore = Score.of(0.85);

    const candidate = new SafePointCandidate({
      id: 'SP-001',
      location,
      safetyScore,
      name: 'Parque Central',
      zoneId: 'zone-1',
    });

    expect(candidate.id).toBe('SP-001');
    expect(candidate.safetyScore.value).toBe(0.85);
    expect(candidate.name).toBe('Parque Central');
    expect(candidate.zoneId).toBe('zone-1');
  });

  it('stores the location GeoPoint correctly', () => {
    const location = GeoPoint.of(1.0, 2.0);
    const candidate = new SafePointCandidate({
      id: 'SP-002',
      location,
      safetyScore: Score.of(0.5),
      name: 'Test',
      zoneId: 'z1',
    });
    expect(candidate.location.lat).toBe(1.0);
    expect(candidate.location.lng).toBe(2.0);
  });
});
