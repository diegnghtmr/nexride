import { GeoPoint } from '../value-objects/geo-point.vo';
import { Score } from '../value-objects/score.vo';

export interface SafePointCandidateProps {
  id: string;
  location: GeoPoint;
  safetyScore: Score;
  name: string;
  zoneId: string;
  /**
   * Catalog-level human description of why this point is safe
   * (TRD §6.6 RTF-23: cada punto seguro almacena razón de seguridad —
   * iluminación, flujo peatonal, cercanía a portería, etc.).
   * Propagated to the API response as `suggested.reasonText` so the
   * rider sees the actual catalog rationale rather than a generic string
   * (RTF-06: "razón breve y comprensible").
   */
  reason: string;
}

export class SafePointCandidate {
  readonly id: string;
  readonly location: GeoPoint;
  readonly safetyScore: Score;
  readonly name: string;
  readonly zoneId: string;
  readonly reason: string;

  constructor(props: SafePointCandidateProps) {
    this.id = props.id;
    this.location = props.location;
    this.safetyScore = props.safetyScore;
    this.name = props.name;
    this.zoneId = props.zoneId;
    this.reason = props.reason;
  }
}
