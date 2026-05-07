import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
 * - All mutations (safepoint row + audit row) execute within a single TypeORM transaction
 *   via dataSource.transaction(callback), ensuring atomic commit/rollback (F8 — REQ-FIX-V8-07).
 */
@Injectable()
export class SafePointsService implements ISafePointsService {
  constructor(
    private readonly repo: SafePointsRepository,
    private readonly dataSource: DataSource,
  ) {}

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
    const reason = input.reason;

    return this.dataSource.transaction(async (manager) => {
      const safePoint = await this.repo.create(input, manager);

      await this.repo.writeAudit(
        {
          safePointId: safePoint.id,
          action: 'CREATE',
          reason,
          changedBy: input.createdBy,
          snapshot: { after: safePoint },
        },
        manager,
      );

      return safePoint;
    });
  }

  async update(id: string, input: UpdateSafePointInput): Promise<SafePoint> {
    if (!input.auditReason || input.auditReason.trim().length === 0) {
      throw new SafePointReasonRequiredError('auditReason is required when updating a safe point', {
        field: 'auditReason',
      });
    }
    const auditReason = input.auditReason;

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException(`SafePoint ${id} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      const updated = await this.repo.update(id, input, manager);
      if (!updated) {
        throw new NotFoundException(`SafePoint ${id} not found after update`);
      }

      await this.repo.writeAudit(
        {
          safePointId: id,
          action: 'UPDATE',
          reason: auditReason,
          changedBy: input.updatedBy,
          snapshot: { before: existing, after: updated },
        },
        manager,
      );

      return updated;
    });
  }

  async deactivate(id: string, reason: string, actorId: string): Promise<SafePoint> {
    if (!reason || reason.trim().length === 0) {
      throw new SafePointReasonRequiredError('reason is required when deactivating a safe point', { field: 'reason' });
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException(`SafePoint ${id} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      const updated = await this.repo.update(
        id,
        {
          status: 'inactive',
          // auditReason is the reason for this deactivation mutation (audit log)
          // We do NOT overwrite the catalog reason during deactivation
          auditReason: reason,
          updatedBy: actorId,
        },
        manager,
      );

      if (!updated) {
        throw new NotFoundException(`SafePoint ${id} not found after deactivation`);
      }

      await this.repo.writeAudit(
        {
          safePointId: id,
          action: 'DEACTIVATE',
          reason,
          changedBy: actorId,
          snapshot: { before: existing, after: updated },
        },
        manager,
      );

      return updated;
    });
  }

  async delete(id: string, reason: string, actorId: string): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new SafePointReasonRequiredError('reason is required when deleting a safe point', { field: 'reason' });
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException(`SafePoint ${id} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      // Write audit BEFORE deletion — preserve snapshot; both inside same TX so FK is safe
      await this.repo.writeAudit(
        {
          safePointId: id,
          action: 'DELETE',
          reason,
          changedBy: actorId,
          snapshot: { before: existing },
        },
        manager,
      );

      await this.repo.delete(id, manager);
    });
  }
}
