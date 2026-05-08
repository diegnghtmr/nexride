export enum DispatchEventName {
  RequestCreated = 'dispatch.request_created',
  SuggestionShown = 'dispatch.suggestion_shown',
  SuggestionAccepted = 'dispatch.suggestion_accepted',
  SuggestionRejected = 'dispatch.suggestion_rejected',
  FallbackActivated = 'dispatch.fallback_activated',
  Completed = 'dispatch.completed',
  TripAssigned = 'trip.assigned',
  NoAvailability = 'dispatch.no_availability',
  // F2 (v0.1.12-mvp): scaffolding only — emit site deferred to RTF-26 post-MVP cancellation use-case.
  Cancelled = 'dispatch.cancelled',
}
