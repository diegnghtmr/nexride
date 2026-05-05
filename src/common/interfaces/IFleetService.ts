import { GeoPoint, VehicleCandidate, VehicleSnapshot } from './shared-types';

export interface IFleetService {
  findCandidatesInRadius(origin: GeoPoint, radiusKm: number): Promise<VehicleCandidate[]>;
  getVehicleSnapshot(id: string): Promise<VehicleSnapshot | null>;
}

export const FLEET_SERVICE = Symbol('IFleetService');
