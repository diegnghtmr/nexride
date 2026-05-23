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
      reason: 'Mejor iluminación nocturna',
    });

    expect(candidate.id).toBe('SP-001');
    expect(candidate.safetyScore.value).toBe(0.85);
    expect(candidate.name).toBe('Parque Central');
    expect(candidate.zoneId).toBe('zone-1');
    expect(candidate.reason).toBe('Mejor iluminación nocturna');
  });

  it('stores the location GeoPoint correctly', () => {
    const location = GeoPoint.of(1.0, 2.0);
    const candidate = new SafePointCandidate({
      id: 'SP-002',
      location,
      safetyScore: Score.of(0.5),
      name: 'Test',
      zoneId: 'z1',
      reason: 'Vigilancia 24/7',
    });
    expect(candidate.location.lat).toBe(1.0);
    expect(candidate.location.lng).toBe(2.0);
  });

  it('propagates catalog reason as a public readonly field (RTF-06 trace: reasonText sourced from catalog, not hardcoded)', () => {
    const candidate = new SafePointCandidate({
      id: 'SP-003',
      location: GeoPoint.of(4.65, -74.05),
      safetyScore: Score.of(0.75),
      name: 'Portería principal',
      zoneId: 'zone-2',
      reason: 'Cercanía a portería de seguridad universitaria',
    });
    expect(candidate.reason).toBe('Cercanía a portería de seguridad universitaria');
  });
});
