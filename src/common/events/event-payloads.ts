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
  riderId: string;
  originalSafety: number;
  suggestedSafety: number;
  walkingM: number;
  safePointId: string;
}

export interface SuggestionAcceptedPayload {
  requestId: string;
  riderId: string;
  tripId: string;
  safePointId: string;
  ts: string;
}

export interface SuggestionRejectedPayload {
  requestId: string;
  riderId: string;
  tripId: string;
  safePointId: string;
  ts: string;
}

export interface FallbackActivatedPayload {
  requestId: string;
  riderId: string;
  reason: 'timeout' | 'empty_after_filter' | 'no_candidates';
  ts: string;
}

export interface CompletedPayload {
  requestId: string;
  riderId: string;
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

export interface NoAvailabilityPayload {
  requestId: string;
  riderId: string;
  reason: string;
  ts: string; // ISO-8601
}

/**
 * F2 (v0.1.12-mvp) — dispatch.cancelled event payload.
 * Scaffolding only: the emit site lives in the future cancellation use-case (RTF-26, post-MVP).
 * Handler (DispatchAnalyticsHandler.onCancelled) persists the row via the existing persist() path.
 *
 * Shape mirrors CompletedPayload for {requestId, riderId, tripId} so persist() can be called identically.
 * Typed reason enum enables analytics grouping without free-form strings.
 */
export interface CancelledPayload {
  requestId: string;
  riderId: string;
  tripId: string;
  reason: 'rider_cancelled' | 'driver_unavailable' | 'timeout' | 'system';
  cancelledBy: 'rider' | 'driver' | 'system';
  ts: string; // ISO-8601
}

export type EventPayloadMap = {
  [DispatchEventName.RequestCreated]: RequestCreatedPayload;
  [DispatchEventName.SuggestionShown]: SuggestionShownPayload;
  [DispatchEventName.SuggestionAccepted]: SuggestionAcceptedPayload;
  [DispatchEventName.SuggestionRejected]: SuggestionRejectedPayload;
  [DispatchEventName.FallbackActivated]: FallbackActivatedPayload;
  [DispatchEventName.Completed]: CompletedPayload;
  [DispatchEventName.TripAssigned]: TripAssignedPayload;
  [DispatchEventName.NoAvailability]: NoAvailabilityPayload;
  [DispatchEventName.Cancelled]: CancelledPayload;
};

export type PayloadOf<E extends DispatchEventName> = EventPayloadMap[E];
