export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface VehicleSnapshot {
  id: string;
  batteryLevelPct: number;
  eligible: boolean;
  status: 'available' | 'in_service' | 'out_of_service';
  lastTelemetryAt: number; // epoch ms
  rangeKm: number;
  location: GeoPoint;
  /** True when snapshot_at is older than FLEET_TELEMETRY_STALENESS_SEC (EH risk #1) */
  telemetryStale: boolean;
}

export interface VehicleCandidate extends VehicleSnapshot {
  distanceFromOriginM: number;
}

export interface SafePoint {
  id: string;
  name: string;
  location: GeoPoint;
  zoneId: string;
  reason: string;
  safetyScore: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTripInput {
  requestId: string;
  riderId: string;
  vehicleId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  pickupLocation: GeoPoint;
  pickupType: 'original' | 'suggested';
  suggestedPointId?: string;
}

export interface Trip {
  id: string;
  requestId: string;
  riderId: string;
  vehicleId: string;
  pickupType: 'original' | 'suggested';
  suggestedPointId?: string;
  pickupLocation: GeoPoint;
  destination: GeoPoint;
  status: 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  assignedAt: Date;
}

export interface PreliminaryDecision {
  requestId: string;
  riderId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  winnerVehicleId: string;
  suggestedPointId?: string;
  scoresJson: Record<string, unknown>;
  fallbackReason?: string;
  suggestionStatus: 'shown' | 'not_shown';
  pipelineDurationMs: number;
}

export interface ConfirmedDecision extends PreliminaryDecision {
  tripId: string;
  userChoice: 'original' | 'suggested';
  confirmedAt: Date;
}
