import { GeoPoint, SafePoint } from './shared-types';

export interface CreateSafePointInput {
  name: string;
  location: GeoPoint;
  zoneId: string;
  /** Intentionally optional — service enforces presence and throws SafePointReasonRequiredError */
  reason?: string;
  safetyScore: number;
  createdBy: string;
}

export interface UpdateSafePointInput {
  name?: string;
  location?: GeoPoint;
  zoneId?: string;
  safetyScore?: number;
  status?: 'active' | 'inactive';
  /** Optional. When provided, updates the catalog `reason` column of the safe-point record. */
  reason?: string;
  /** Mandatory. Why this mutation is happening — written to the audit row,
   *  never to the catalog `reason` column. */
  auditReason: string;
  updatedBy: string;
}

export interface ISafePointsService {
  findWithin(point: GeoPoint, radiusM: number): Promise<SafePoint[]>;
  findById(id: string): Promise<SafePoint | null>;
  create(input: CreateSafePointInput): Promise<SafePoint>;
  update(id: string, input: UpdateSafePointInput): Promise<SafePoint>;
  /** F5 (v0.1.12-mvp): symmetric to deactivate(); writes audit row with action='ACTIVATE'. */
  activate(id: string, reason: string, actorId: string): Promise<SafePoint>;
  deactivate(id: string, reason: string, actorId: string): Promise<SafePoint>;
  delete(id: string, reason: string, actorId: string): Promise<void>;
}

export const SAFE_POINTS_SERVICE = Symbol('ISafePointsService');
