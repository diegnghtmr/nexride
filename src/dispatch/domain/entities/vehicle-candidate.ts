import { GeoPoint } from '../value-objects/geo-point.vo';

export interface VehicleCandidateProps {
  id: string;
  location: GeoPoint;
  batteryPct: number;
  autonomyKm: number;
  eligibility: 'eligible' | 'not_eligible';
  state: 'available' | 'busy' | 'out_of_service';
  telemetryAt: Date;
}

export class VehicleCandidate {
  readonly id: string;
  readonly location: GeoPoint;
  readonly batteryPct: number;
  readonly autonomyKm: number;
  readonly eligibility: 'eligible' | 'not_eligible';
  readonly state: 'available' | 'busy' | 'out_of_service';
  readonly telemetryAt: Date;

  constructor(props: VehicleCandidateProps) {
    this.id = props.id;
    this.location = props.location;
    this.batteryPct = props.batteryPct;
    this.autonomyKm = props.autonomyKm;
    this.eligibility = props.eligibility;
    this.state = props.state;
    this.telemetryAt = props.telemetryAt;
  }
}
