import { IDistanceProvider } from '../../../common/interfaces/IDistanceProvider';
import { DispatchConfig } from '../../../common/config/dispatch.config';
import { GeoPoint } from '../value-objects/geo-point.vo';
import { VehicleCandidate } from '../entities/vehicle-candidate';
import { SafePointCandidate } from '../entities/safe-point-candidate';

export interface ScoreInput {
  origin: GeoPoint;
  vehicle: VehicleCandidate;
  safePoint: SafePointCandidate | null;
  tripDistanceKm: number;
  zoneFactor: number;
}

export interface ScoreResult {
  proximity: number;
  energy: number;
  safety: number;
  continuity: number;
  total: number;
  etaSeconds: number;
  walkingMeters: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export class ScoringEngine {
  constructor(
    private readonly distance: IDistanceProvider,
    private readonly cfg: DispatchConfig,
  ) {}

  async score(input: ScoreInput): Promise<ScoreResult> {
    const { origin, vehicle, safePoint, tripDistanceKm, zoneFactor } = input;

    // ETA via distance provider
    const distResult = await this.distance.getEtaSeconds(origin, vehicle.location);
    const etaSeconds = distResult.etaSeconds;

    // proximity = max(0, 1 - eta / maxEtaSeconds)
    const proximity = Math.max(0, 1 - etaSeconds / this.cfg.maxEtaSeconds);

    // energy = clamp01( autonomy / (requiredKm * (1 + minimumReservePct)) )
    // minimumReservePct is stored as fraction (0.15), so factor = 1.15
    const reserveFactor = 1 + this.cfg.fleet.minimumReservePct;
    const energy = clamp01(vehicle.autonomyKm / (tripDistanceKm * reserveFactor));

    // safety = safePoint.safetyScore.value OR originalSafetyBaseline
    const safety = safePoint ? safePoint.safetyScore.value : this.cfg.originalSafetyBaseline;

    // continuity = batteryWeight * clamp01(projectedBatteryPct/100) + zoneWeight * zoneFactor
    const projectedBatteryPct = vehicle.batteryPct - (tripDistanceKm / vehicle.autonomyKm) * 100;
    const continuity =
      this.cfg.scoring.continuityBatteryWeight * clamp01(projectedBatteryPct / 100) +
      this.cfg.scoring.continuityZoneWeight * zoneFactor;

    // total = weighted sum
    const w = this.cfg.weights;
    const total = w.proximity * proximity + w.energy * energy + w.safety * safety + w.continuity * continuity;

    // walkingMeters: Haversine from origin to safePoint location
    const walkingMeters = safePoint ? origin.distanceKmHaversine(safePoint.location) * 1000 : 0;

    return { proximity, energy, safety, continuity, total, etaSeconds, walkingMeters };
  }
}
