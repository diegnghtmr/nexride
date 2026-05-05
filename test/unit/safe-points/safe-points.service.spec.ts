/**
 * Unit tests for SafePointsService
 *
 * Strict TDD: written before implementation (RED phase), then made GREEN.
 * Repository is fully mocked — no database I/O.
 *
 * 7 scenarios (exceeds minimum of 6):
 * 1. missing reason on create → throws SafePointReasonRequiredError
 * 2. create writes audit row with action=CREATE
 * 3. update writes audit row with action=UPDATE
 * 4. delete writes audit row with action=DELETE
 * 5. deactivate writes audit row with action=DEACTIVATE
 * 6. findWithin delegates to repository
 * 7. update with missing reason → throws SafePointReasonRequiredError
 */

import { SafePointsService } from '../../../src/safe-points/safe-points.service';
import { SafePointsRepository } from '../../../src/safe-points/infrastructure/safe-points.repository';
import { SafePointReasonRequiredError } from '../../../src/common/errors/domain-error';
import { SafePoint } from '../../../src/common/interfaces/shared-types';

const mockSafePoint: SafePoint = {
  id: 'sp-uuid-001',
  name: 'Parque Norte',
  zoneId: 'zone-001',
  reason: 'Alta iluminación',
  safetyScore: 0.8,
  status: 'active',
  location: { lat: 4.65, lng: -74.05 },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function makeRepo(): jest.Mocked<SafePointsRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findWithin: jest.fn(),
    writeAudit: jest.fn(),
    dataSource: undefined,
  } as unknown as jest.Mocked<SafePointsRepository>;
}

describe('SafePointsService', () => {
  let service: SafePointsService;
  let repo: jest.Mocked<SafePointsRepository>;

  beforeEach(() => {
    repo = makeRepo();
    service = new SafePointsService(repo);
  });

  describe('create()', () => {
    it('1. missing reason throws SafePointReasonRequiredError', async () => {
      await expect(
        service.create({
          name: 'Sin Razón',
          zoneId: 'zone-1',
          reason: '',
          safetyScore: 0.5,
          location: { lat: 4.65, lng: -74.05 },
          createdBy: 'user-1',
        }),
      ).rejects.toBeInstanceOf(SafePointReasonRequiredError);

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.writeAudit).not.toHaveBeenCalled();
    });

    it('2. create writes audit row with action=CREATE', async () => {
      repo.create.mockResolvedValue(mockSafePoint);
      repo.writeAudit.mockResolvedValue(undefined);

      const result = await service.create({
        name: mockSafePoint.name,
        zoneId: mockSafePoint.zoneId,
        reason: mockSafePoint.reason,
        safetyScore: mockSafePoint.safetyScore,
        location: mockSafePoint.location,
        createdBy: 'user-1',
      });

      expect(result).toBe(mockSafePoint);
      expect(repo.writeAudit).toHaveBeenCalledTimes(1);
      expect(repo.writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          safePointId: mockSafePoint.id,
          action: 'CREATE',
          reason: mockSafePoint.reason,
          changedBy: 'user-1',
        }),
      );
    });
  });

  describe('update()', () => {
    it('7. update with missing reason throws SafePointReasonRequiredError', async () => {
      await expect(
        service.update('sp-uuid-001', {
          reason: '',
          updatedBy: 'user-1',
        }),
      ).rejects.toBeInstanceOf(SafePointReasonRequiredError);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('3. update writes audit row with action=UPDATE', async () => {
      const updatedPoint = { ...mockSafePoint, name: 'Parque Sur' };
      repo.findById.mockResolvedValue(mockSafePoint);
      repo.update.mockResolvedValue(updatedPoint);
      repo.writeAudit.mockResolvedValue(undefined);

      const result = await service.update('sp-uuid-001', {
        name: 'Parque Sur',
        reason: 'Cambio de nombre',
        updatedBy: 'user-2',
      });

      expect(result.name).toBe('Parque Sur');
      expect(repo.writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          safePointId: 'sp-uuid-001',
          action: 'UPDATE',
          reason: 'Cambio de nombre',
          changedBy: 'user-2',
        }),
      );
    });
  });

  describe('delete()', () => {
    it('4. delete writes audit row with action=DELETE', async () => {
      repo.findById.mockResolvedValue(mockSafePoint);
      repo.writeAudit.mockResolvedValue(undefined);
      repo.delete.mockResolvedValue(undefined);

      await service.delete('sp-uuid-001', 'Ya no necesario', 'user-3');

      expect(repo.writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          safePointId: 'sp-uuid-001',
          action: 'DELETE',
          reason: 'Ya no necesario',
          changedBy: 'user-3',
        }),
      );
      // Audit is written BEFORE delete to preserve the snapshot
      expect(repo.writeAudit.mock.invocationCallOrder[0]).toBeLessThan(repo.delete.mock.invocationCallOrder[0]);
    });
  });

  describe('deactivate()', () => {
    it('5. deactivate writes audit row with action=DEACTIVATE', async () => {
      const deactivatedPoint = { ...mockSafePoint, status: 'inactive' as const };
      repo.findById.mockResolvedValue(mockSafePoint);
      repo.update.mockResolvedValue(deactivatedPoint);
      repo.writeAudit.mockResolvedValue(undefined);

      const result = await service.deactivate('sp-uuid-001', 'Temporalmente inactivo', 'user-4');

      expect(result.status).toBe('inactive');
      expect(repo.writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          safePointId: 'sp-uuid-001',
          action: 'DEACTIVATE',
          reason: 'Temporalmente inactivo',
          changedBy: 'user-4',
        }),
      );
    });
  });

  describe('findWithin()', () => {
    it('6. findWithin delegates to repository', async () => {
      repo.findWithin.mockResolvedValue([mockSafePoint]);

      const result = await service.findWithin({ lat: 4.65, lng: -74.05 }, 120);

      expect(result).toEqual([mockSafePoint]);
      expect(repo.findWithin).toHaveBeenCalledWith({ lat: 4.65, lng: -74.05 }, 120);
    });
  });
});
