import { RequestId } from '../value-objects/request-id.vo';
import { GeoPoint } from '../value-objects/geo-point.vo';

export interface DispatchDecisionProps {
  requestId: RequestId;
  vehicleId: string;
  originalPoint: GeoPoint;
  suggestedPoint?: GeoPoint;
  scoresJson: Record<string, unknown>;
  fallbackReason?: string;
  createdAt: Date;
  tripId?: string;
  userChoice?: 'original' | 'suggested';
}

export class DispatchDecision {
  readonly requestId: RequestId;
  readonly vehicleId: string;
  readonly originalPoint: GeoPoint;
  readonly suggestedPoint?: GeoPoint;
  readonly scoresJson: Record<string, unknown>;
  readonly fallbackReason?: string;
  readonly createdAt: Date;
  readonly tripId?: string;
  readonly userChoice?: 'original' | 'suggested';

  constructor(props: DispatchDecisionProps) {
    this.requestId = props.requestId;
    this.vehicleId = props.vehicleId;
    this.originalPoint = props.originalPoint;
    this.suggestedPoint = props.suggestedPoint;
    this.scoresJson = props.scoresJson;
    this.fallbackReason = props.fallbackReason;
    this.createdAt = props.createdAt;
    this.tripId = props.tripId;
    this.userChoice = props.userChoice;
  }
}
