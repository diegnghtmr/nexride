import { GeoPoint } from '../value-objects/geo-point.vo';
import { Score } from '../value-objects/score.vo';

export interface SafePointCandidateProps {
  id: string;
  location: GeoPoint;
  safetyScore: Score;
  name: string;
  zoneId: string;
}

export class SafePointCandidate {
  readonly id: string;
  readonly location: GeoPoint;
  readonly safetyScore: Score;
  readonly name: string;
  readonly zoneId: string;

  constructor(props: SafePointCandidateProps) {
    this.id = props.id;
    this.location = props.location;
    this.safetyScore = props.safetyScore;
    this.name = props.name;
    this.zoneId = props.zoneId;
  }
}
