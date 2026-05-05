import { RequestId } from '@dispatch/domain/value-objects/request-id.vo';
import { GeoPoint } from '@dispatch/domain/value-objects/geo-point.vo';
import { DispatchDecision } from '@dispatch/domain/entities/dispatch-decision';

describe('DispatchDecision entity', () => {
  it('creates a preliminary dispatch decision without tripId or userChoice', () => {
    const requestId = RequestId.from('550e8400-e29b-41d4-a716-446655440000');
    const origin = GeoPoint.of(4.65, -74.05);
    const decision = new DispatchDecision({
      requestId,
      vehicleId: 'VH-001',
      originalPoint: origin,
      scoresJson: { proximity: 0.6, total: 0.55 },
      createdAt: new Date(),
    });

    expect(decision.requestId.value).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(decision.vehicleId).toBe('VH-001');
    expect(decision.tripId).toBeUndefined();
    expect(decision.userChoice).toBeUndefined();
    expect(decision.fallbackReason).toBeUndefined();
    expect(decision.suggestedPoint).toBeUndefined();
  });

  it('creates a decision with a suggested point', () => {
    const requestId = RequestId.from('550e8400-e29b-41d4-a716-446655440001');
    const origin = GeoPoint.of(4.65, -74.05);
    const suggested = GeoPoint.of(4.6502, -74.0498);
    const decision = new DispatchDecision({
      requestId,
      vehicleId: 'VH-002',
      originalPoint: origin,
      suggestedPoint: suggested,
      scoresJson: { total: 0.69 },
      createdAt: new Date(),
    });

    expect(decision.suggestedPoint?.lat).toBe(4.6502);
  });

  it('creates a decision with fallback reason', () => {
    const requestId = RequestId.from('550e8400-e29b-41d4-a716-446655440002');
    const origin = GeoPoint.of(4.65, -74.05);
    const decision = new DispatchDecision({
      requestId,
      vehicleId: 'VH-003',
      originalPoint: origin,
      scoresJson: {},
      fallbackReason: 'timeout',
      createdAt: new Date(),
    });

    expect(decision.fallbackReason).toBe('timeout');
  });

  it('creates a confirmed decision with tripId and userChoice', () => {
    const requestId = RequestId.from('550e8400-e29b-41d4-a716-446655440003');
    const origin = GeoPoint.of(4.65, -74.05);
    const decision = new DispatchDecision({
      requestId,
      vehicleId: 'VH-004',
      originalPoint: origin,
      scoresJson: {},
      tripId: 'trip-abc',
      userChoice: 'original',
      createdAt: new Date(),
    });

    expect(decision.tripId).toBe('trip-abc');
    expect(decision.userChoice).toBe('original');
  });
});
