import { DispatchEventName } from './event-names';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RequestCreatedPayload {
  requestId: string;
  riderId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  ts: string;
}

export interface SuggestionShownPayload {
  requestId: string;
  originalSafety: number;
  suggestedSafety: number;
  walkingM: number;
  safePointId: string;
}

export interface SuggestionAcceptedPayload {
  requestId: string;
  tripId: string;
  safePointId: string;
  ts: string;
}

export interface SuggestionRejectedPayload {
  requestId: string;
  tripId: string;
  safePointId: string;
  ts: string;
}

export interface FallbackActivatedPayload {
  requestId: string;
  reason: 'timeout' | 'empty_after_filter' | 'no_candidates';
  ts: string;
}

export interface CompletedPayload {
  requestId: string;
  tripId: string;
  durationMs: number;
  winnerVehicleId: string;
  fallback: boolean;
}

export interface TripAssignedPayload {
  tripId: string;
  requestId: string;
  riderId: string;
  vehicleId: string;
  pickupType: 'original' | 'suggested';
  suggestedPointId?: string;
  ts: string;
}

export type EventPayloadMap = {
  [DispatchEventName.RequestCreated]: RequestCreatedPayload;
  [DispatchEventName.SuggestionShown]: SuggestionShownPayload;
  [DispatchEventName.SuggestionAccepted]: SuggestionAcceptedPayload;
  [DispatchEventName.SuggestionRejected]: SuggestionRejectedPayload;
  [DispatchEventName.FallbackActivated]: FallbackActivatedPayload;
  [DispatchEventName.Completed]: CompletedPayload;
  [DispatchEventName.TripAssigned]: TripAssignedPayload;
};

export type PayloadOf<E extends DispatchEventName> = EventPayloadMap[E];
