import { DispatchEventName } from '../../../../src/common/events/event-names';
import {
  RequestCreatedPayload,
  SuggestionShownPayload,
  FallbackActivatedPayload,
} from '../../../../src/common/events/event-payloads';
import { TypedEventBus } from '../../../../src/common/events/event-bus';

describe('DispatchEventName', () => {
  it('contains all required event names with correct string values', () => {
    expect(DispatchEventName.RequestCreated).toBe('dispatch.request_created');
    expect(DispatchEventName.SuggestionShown).toBe('dispatch.suggestion_shown');
    expect(DispatchEventName.SuggestionAccepted).toBe('dispatch.suggestion_accepted');
    expect(DispatchEventName.SuggestionRejected).toBe('dispatch.suggestion_rejected');
    expect(DispatchEventName.FallbackActivated).toBe('dispatch.fallback_activated');
    expect(DispatchEventName.Completed).toBe('dispatch.completed');
    expect(DispatchEventName.TripAssigned).toBe('trip.assigned');
  });
});

describe('TypedEventBus', () => {
  it('emits and receives typed RequestCreated payload', (done) => {
    const bus = new TypedEventBus();
    const expectedPayload: RequestCreatedPayload = {
      requestId: 'req-001',
      riderId: 'rider-001',
      origin: { lat: 4.65, lng: -74.05 },
      destination: { lat: 4.7, lng: -74.06 },
      ts: new Date().toISOString(),
    };

    bus.onTyped(DispatchEventName.RequestCreated, (payload) => {
      expect(payload.requestId).toBe('req-001');
      expect(payload.riderId).toBe('rider-001');
      expect(payload.origin.lat).toBe(4.65);
      done();
    });

    bus.emitTyped(DispatchEventName.RequestCreated, expectedPayload);
  });

  it('emits and receives SuggestionShown payload with correct fields', (done) => {
    const bus = new TypedEventBus();
    const payload: SuggestionShownPayload = {
      requestId: 'req-002',
      originalSafety: 0.3,
      suggestedSafety: 0.85,
      walkingM: 95,
      safePointId: 'sp-12',
    };

    bus.onTyped(DispatchEventName.SuggestionShown, (received) => {
      expect(received.safePointId).toBe('sp-12');
      expect(received.walkingM).toBe(95);
      done();
    });

    bus.emitTyped(DispatchEventName.SuggestionShown, payload);
  });

  it('emits and receives FallbackActivated payload with reason field', (done) => {
    const bus = new TypedEventBus();
    const payload: FallbackActivatedPayload = {
      requestId: 'req-003',
      reason: 'timeout',
      ts: new Date().toISOString(),
    };

    bus.onTyped(DispatchEventName.FallbackActivated, (received) => {
      expect(received.reason).toBe('timeout');
      expect(received.requestId).toBe('req-003');
      done();
    });

    bus.emitTyped(DispatchEventName.FallbackActivated, payload);
  });

  it('supports multiple listeners on the same event channel', (done) => {
    const bus = new TypedEventBus();
    let count = 0;

    const checkDone = () => {
      count++;
      if (count === 2) done();
    };

    bus.onTyped(DispatchEventName.RequestCreated, () => checkDone());
    bus.onTyped(DispatchEventName.RequestCreated, () => checkDone());

    bus.emitTyped(DispatchEventName.RequestCreated, {
      requestId: 'req-multi',
      riderId: 'rider-x',
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      ts: new Date().toISOString(),
    });
  });
});
