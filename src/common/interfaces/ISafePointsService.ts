import { GeoPoint, SafePoint } from './shared-types';

export interface CreateSafePointInput {
  name: string;
  location: GeoPoint;
  zoneId: string;
  reason: string;
  safetyScore: number;
  createdBy: string;
}

export interface UpdateSafePointInput {
  name?: string;
  location?: GeoPoint;
  zoneId?: string;
  safetyScore?: number;
  status?: 'active' | 'inactive';
  reason: string; // required for audit
  updatedBy: string;
}

export interface ISafePointsService {
  findWithin(point: GeoPoint, radiusM: number): Promise<SafePoint[]>;
  findById(id: string): Promise<SafePoint | null>;
  create(input: CreateSafePointInput): Promise<SafePoint>;
  update(id: string, input: UpdateSafePointInput): Promise<SafePoint>;
  deactivate(id: string, reason: string, actorId: string): Promise<SafePoint>;
  delete(id: string, reason: string, actorId: string): Promise<void>;
}

export const SAFE_POINTS_SERVICE = Symbol('ISafePointsService');
