import { VehicleCandidate } from '../entities/vehicle-candidate';
import { DispatchConfig } from '../../../common/config/dispatch.config';

export interface FilterRejection {
  vehicleId: string;
  reason: string;
}

export interface FilterResult {
  passed: VehicleCandidate[];
  rejections: FilterRejection[];
}

export class CandidateFilter {
  constructor(
    private readonly cfg: DispatchConfig,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  filter(candidates: VehicleCandidate[], requiredKm: number): FilterResult {
    const passed: VehicleCandidate[] = [];
    const rejections: FilterRejection[] = [];
    const now = this.clock();

    for (const vehicle of candidates) {
      const rejection = this.evaluate(vehicle, requiredKm, now);
      if (rejection) {
        rejections.push({ vehicleId: vehicle.id, reason: rejection });
      } else {
        passed.push(vehicle);
      }
    }

    return { passed, rejections };
  }

  private evaluate(vehicle: VehicleCandidate, requiredKm: number, now: Date): string | null {
    // Rule 1: operational state
    if (vehicle.state === 'out_of_service') {
      return 'out_of_service';
    }

    // Rule 2: driver eligibility
    if (vehicle.eligibility === 'not_eligible') {
      return 'not_eligible';
    }

    // Rule 3: battery autonomy (must cover (tripKm + vehicleToPickupKm) × (1 + reservePct))
    const vehicleToPickupKm = vehicle.distanceFromOriginM / 1000;
    const threshold = (requiredKm + vehicleToPickupKm) * (1 + this.cfg.fleet.minimumReservePct);
    if (vehicle.autonomyKm < threshold) {
      return 'insufficient_battery';
    }

    // Rule 4: telemetry staleness — AT staleness boundary = stale (inclusive)
    const telemetryAgeSeconds = (now.getTime() - vehicle.telemetryAt.getTime()) / 1000;
    if (telemetryAgeSeconds >= this.cfg.fleet.telemetryStalenessSec) {
      return 'stale_telemetry';
    }

    return null;
  }
}
