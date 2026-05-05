import { IFleetService } from '../../../common/interfaces/IFleetService';
import { DispatchConfig } from '../../../common/config/dispatch.config';
import { GeoPoint } from '../value-objects/geo-point.vo';
import { NoAvailabilityError } from '../../../common/errors/domain-error';
import type { VehicleCandidate } from '../../../common/interfaces/shared-types';

export type FallbackReason = 'timeout' | 'no_candidates' | 'distance_unavailable';

export interface FallbackResult {
  vehicleId: string;
  fallbackReason: FallbackReason;
  fallbackDistanceKm: number;
}

export class FallbackHandler {
  constructor(
    private readonly fleet: IFleetService,
    private readonly cfg: DispatchConfig,
  ) {}

  async fallback(origin: GeoPoint, reason: FallbackReason): Promise<FallbackResult> {
    const candidates = await this.fleet.findCandidatesInRadius(origin, this.cfg.candidateRadiusKm);

    // Filter: battery >= fallbackMinBatteryPct AND eligibility AND status available
    // Skip telemetry staleness check in degraded fallback mode
    const viable = candidates.filter(
      (v: VehicleCandidate) =>
        v.batteryLevelPct >= this.cfg.fallbackMinBatteryPct &&
        v.eligible === true &&
        // 'in_service' and 'available' are both operational; only out_of_service is excluded.
        (v.status === 'available' || v.status === 'in_service'),
    );

    if (viable.length === 0) {
      throw new NoAvailabilityError('No viable vehicle found during fallback', { reason });
    }

    // Pick nearest by Haversine distance
    const withDistance = viable.map((v: VehicleCandidate) => {
      const vehicleLoc = GeoPoint.of(v.location.lat, v.location.lng);
      const distanceKm = origin.distanceKmHaversine(vehicleLoc);
      return { v, distanceKm };
    });

    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    const nearest = withDistance[0];

    return {
      vehicleId: nearest.v.id,
      fallbackReason: reason,
      fallbackDistanceKm: nearest.distanceKm,
    };
  }
}
