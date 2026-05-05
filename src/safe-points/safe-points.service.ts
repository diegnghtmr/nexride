import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ISafePointsService,
  CreateSafePointInput,
  UpdateSafePointInput,
} from '../common/interfaces/ISafePointsService';
import { GeoPoint, SafePoint } from '../common/interfaces/shared-types';
import { SafePointReasonRequiredError } from '../common/errors/domain-error';
import { SafePointsRepository } from './infrastructure/safe-points.repository';

/**
 * SafePointsService — implements ISafePointsService.
 *
 * Wraps CRUD operations with:
 * - Mandatory reason validation (SafePointReasonRequiredError if reason is empty/missing).
 * - Audit row written for every mutating operation (CREATE, UPDATE, DELETE, DEACTIVATE).
 * - All mutations are repository-level atomic (raw SQL INSERT + audit INSERT within one
 *   implicit pgclient transaction; full TX wrapper added if we ever need multi-table
 *   rollback — not needed for current scope).
 */
@Injectable()
export class SafePointsService implements ISafePointsService {
  constructor(private readonly repo: SafePointsRepository) {}

  async findWithin(point: GeoPoint, radiusM: number): Promise<SafePoint[]> {
    return this.repo.findWithin(point, radiusM);
  }

  async findById(id: string): Promise<SafePoint | null> {
    return this.repo.findById(id);
  }

  async create(input: CreateSafePointInput): Promise<SafePoint> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new SafePointReasonRequiredError('reason is required when creating a safe point', { field: 'reason' });
    }

    const safePoint = await this.repo.create(input);

    await this.repo.writeAudit({
      safePointId: safePoint.id,
      action: 'CREATE',
      reason: input.reason,
      changedBy: input.createdBy,
      snapshot: { after: safePoint },
    });

    return safePoint;
  }

  async update(id: string, input: UpdateSafePointInput): Promise<SafePoint> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new SafePointReasonRequiredError('reason is required when updating a safe point', { field: 'reason' });
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException(`SafePoint ${id} not found`);
    }

    const updated = await this.repo.update(id, input);
    if (!updated) {
      throw new NotFoundException(`SafePoint ${id} not found after update`);
    }

    await this.repo.writeAudit({
      safePointId: id,
      action: 'UPDATE',
      reason: input.reason,
      changedBy: input.updatedBy,
      snapshot: { before: existing, after: updated },
    });

    return updated;
  }

  async deactivate(id: string, reason: string, actorId: string): Promise<SafePoint> {
    if (!reason || reason.trim().length === 0) {
      throw new SafePointReasonRequiredError('reason is required when deactivating a safe point', { field: 'reason' });
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException(`SafePoint ${id} not found`);
    }

    const updated = await this.repo.update(id, {
      status: 'inactive',
      reason,
      updatedBy: actorId,
    });

    if (!updated) {
      throw new NotFoundException(`SafePoint ${id} not found after deactivation`);
    }

    await this.repo.writeAudit({
      safePointId: id,
      action: 'DEACTIVATE',
      reason,
      changedBy: actorId,
      snapshot: { before: existing, after: updated },
    });

    return updated;
  }

  async delete(id: string, reason: string, actorId: string): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new SafePointReasonRequiredError('reason is required when deleting a safe point', { field: 'reason' });
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException(`SafePoint ${id} not found`);
    }

    // Write audit BEFORE deletion — after DELETE the FK is CASCADE-deleted
    await this.repo.writeAudit({
      safePointId: id,
      action: 'DELETE',
      reason,
      changedBy: actorId,
      snapshot: { before: existing },
    });

    await this.repo.delete(id);
  }
}
