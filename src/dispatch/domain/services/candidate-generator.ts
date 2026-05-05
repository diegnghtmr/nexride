import { GeoPoint } from '../value-objects/geo-point.vo';
import { Score } from '../value-objects/score.vo';
import { VehicleCandidate } from '../entities/vehicle-candidate';
import { SafePointCandidate } from '../entities/safe-point-candidate';
import { IFleetService } from '../../../common/interfaces/IFleetService';
import { ISafePointsService } from '../../../common/interfaces/ISafePointsService';
import { DispatchConfig } from '../../../common/config/dispatch.config';
import {
  VehicleCandidate as SharedVehicleCandidate,
  SafePoint as SharedSafePoint,
} from '../../../common/interfaces/shared-types';

export class CandidateGenerator {
  constructor(
    private readonly fleet: IFleetService,
    private readonly safePoints: ISafePointsService,
    private readonly cfg: DispatchConfig,
  ) {}

  async generate(origin: GeoPoint): Promise<{
    vehicles: VehicleCandidate[];
    safePoints: SafePointCandidate[];
  }> {
    const [rawVehicles, rawSafePoints] = await Promise.all([
      this.fleet.findCandidatesInRadius(origin, this.cfg.candidateRadiusKm),
      this.safePoints.findWithin(origin, this.cfg.safePointRadiusM),
    ]);

    const vehicles = rawVehicles.map(
      (v: SharedVehicleCandidate) =>
        new VehicleCandidate({
          id: v.id,
          location: GeoPoint.of(v.location.lat, v.location.lng),
          batteryPct: v.batteryLevelPct,
          autonomyKm: v.rangeKm,
          eligibility: v.eligible ? 'eligible' : 'not_eligible',
          state: v.status === 'available' ? 'available' : v.status === 'out_of_service' ? 'out_of_service' : 'busy',
          telemetryAt: new Date(v.lastTelemetryAt),
        }),
    );

    const safePointCandidates = rawSafePoints.map(
      (sp: SharedSafePoint) =>
        new SafePointCandidate({
          id: sp.id,
          location: GeoPoint.of(sp.location.lat, sp.location.lng),
          safetyScore: Score.of(sp.safetyScore),
          name: sp.name,
          zoneId: sp.zoneId,
        }),
    );

    return { vehicles, safePoints: safePointCandidates };
  }
}
