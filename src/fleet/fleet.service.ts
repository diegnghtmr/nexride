import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFleetService } from '../common/interfaces/IFleetService';
import { GeoPoint, VehicleCandidate, VehicleSnapshot } from '../common/interfaces/shared-types';
import { RedisFleetAdapter } from './infrastructure/redis-fleet.adapter';

/**
 * FleetService — implements IFleetService.
 *
 * Reads from RedisFleetAdapter; computes telemetry staleness using
 * FLEET_TELEMETRY_STALENESS_SEC from config (design §4, EH risk #1).
 *
 * Staleness boundary (per spec EH risk #1): a snapshot is stale AT 60s
 * (exclusive freshness). That is:
 *   ageSeconds >= stalenessSec → stale = true
 */
@Injectable()
export class FleetService implements IFleetService {
  private readonly stalenessSec: number;

  constructor(
    readonly redisAdapter: RedisFleetAdapter,
    private readonly configService: ConfigService,
  ) {
    this.stalenessSec = this.configService.get<number>('FLEET_TELEMETRY_STALENESS_SEC') ?? 60;
  }

  async findCandidatesInRadius(origin: GeoPoint, radiusKm: number): Promise<VehicleCandidate[]> {
    const vehicleRefs = await this.redisAdapter.getVehicleIdsInRadius(origin, radiusKm);
    if (vehicleRefs.length === 0) return [];

    const candidates = await Promise.all(
      vehicleRefs.map(async ({ id, distanceM, location }) => {
        const snapshot = await this.buildSnapshot(id, distanceM, location);
        return snapshot;
      }),
    );

    // Filter out vehicles that couldn't be read from Redis
    return candidates.filter((c): c is VehicleCandidate => c !== null);
  }

  async getVehicleSnapshot(id: string): Promise<(VehicleSnapshot & { telemetryStale: boolean }) | null> {
    return this.buildSnapshot(id);
  }

  private async buildSnapshot(
    id: string,
    distanceFromOriginM?: number,
    location?: { lat: number; lng: number },
  ): Promise<VehicleCandidate | null> {
    const hash = await this.redisAdapter.getVehicleHash(id);
    if (!hash) return null;

    const snapshotAtMs = hash['snapshot_at'] ? new Date(hash['snapshot_at']).getTime() : Date.now();

    const ageSeconds = (Date.now() - snapshotAtMs) / 1000;
    const telemetryStale = ageSeconds >= this.stalenessSec;

    const snapshot: VehicleSnapshot & { telemetryStale: boolean } = {
      id,
      batteryLevelPct: parseFloat(hash['battery_pct'] ?? '0'),
      eligible: hash['eligible'] === '1',
      status: (hash['state'] as 'available' | 'in_service' | 'out_of_service') ?? 'out_of_service',
      lastTelemetryAt: snapshotAtMs,
      rangeKm: parseFloat(hash['range_km'] ?? '0'),
      location: location ?? { lat: 0, lng: 0 },
      telemetryStale,
    };

    return {
      ...snapshot,
      distanceFromOriginM: distanceFromOriginM ?? 0,
    };
  }
}
