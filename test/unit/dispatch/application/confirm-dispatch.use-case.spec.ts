/**
 * Unit tests for ConfirmDispatchUseCase
 *
 * Strict TDD: RED phase written before W-5 implementation.
 *
 * Key assertion: the use case must call the pessimistic_write-locked find
 * INSIDE the transaction before deciding whether to throw or proceed.
 * This prevents double-confirm race conditions.
 */

import { ConfirmDispatchUseCase } from '../../../../src/dispatch/application/confirm-dispatch.use-case';
import { IDecisionRepository } from '../../../../src/common/interfaces/IDecisionRepository';
import { ITripService } from '../../../../src/common/interfaces/ITripService';
import { RequestNotFoundError, RequestAlreadyConfirmedError } from '../../../../src/common/errors/domain-error';
import { DispatchDecisionEntity } from '../../../../src/dispatch/infrastructure/persistence/dispatch-decision.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';

// Minimal fixture
const BASE_ENTITY: Partial<DispatchDecisionEntity> = {
  requestId: 'req-001',
  riderId: 'rider-001',
  vehicleId: 'VH-001',
  originalLat: 4.65,
  originalLng: -74.05,
  suggestedPointId: null,
  tripId: null,
  suggestionStatus: 'not_shown',
  scoresJson: {},
  fallbackReason: null,
};

function makeManager(entity: Partial<DispatchDecisionEntity> | null): jest.Mocked<EntityManager> {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(entity),
  } as unknown as jest.Mocked<SelectQueryBuilder<DispatchDecisionEntity>>;

  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    query: jest.fn().mockResolvedValue(undefined),
    getRepository: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(entity) }),
  } as unknown as jest.Mocked<EntityManager>;
}

function makeDataSource(entity: Partial<DispatchDecisionEntity> | null): jest.Mocked<DataSource> {
  const manager = makeManager(entity);
  return {
    transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
  } as unknown as jest.Mocked<DataSource>;
}

function makeDecisionRepo(): jest.Mocked<IDecisionRepository> {
  return {
    savePreliminary: jest.fn(),
    updateConfirmed: jest.fn(),
    findByRequestId: jest.fn().mockResolvedValue({
      requestId: 'req-001',
      riderId: 'rider-001',
      origin: { lat: 4.65, lng: -74.05 },
      destination: { lat: 4.7, lng: -74.1 },
      winnerVehicleId: 'VH-001',
      suggestedPointId: undefined,
      scoresJson: {},
      suggestionStatus: 'not_shown',
      pipelineDurationMs: 200,
    }),
  };
}

function makeTripService(): jest.Mocked<ITripService> {
  return {
    createMinimum: jest.fn().mockResolvedValue({
      id: 'trip-uuid-001',
      requestId: 'req-001',
      riderId: 'rider-001',
      vehicleId: 'VH-001',
      pickupType: 'original',
      pickupLocation: { lat: 4.65, lng: -74.05 },
      destination: { lat: 4.7, lng: -74.1 },
      status: 'assigned',
      createdAt: new Date(),
      assignedAt: new Date(),
    }),
  };
}

function makeEventEmitter(): jest.Mocked<EventEmitter2> {
  return {
    emit: jest.fn(),
  } as unknown as jest.Mocked<EventEmitter2>;
}

describe('ConfirmDispatchUseCase — W-5 SELECT FOR UPDATE', () => {
  it('calls createQueryBuilder with pessimistic_write lock inside the transaction', async () => {
    const dataSource = makeDataSource(BASE_ENTITY);
    const manager = (dataSource.transaction as jest.Mock).mock.calls[0]?.[0]
      ? undefined
      : null;
    // We capture the manager via the transaction mock
    let capturedManager: EntityManager | undefined;
    (dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb: (m: EntityManager) => Promise<unknown>) => {
      capturedManager = makeManager(BASE_ENTITY) as unknown as EntityManager;
      return cb(capturedManager);
    });

    const decisionRepo = makeDecisionRepo();
    const tripService = makeTripService();
    const eventEmitter = makeEventEmitter();

    const useCase = new ConfirmDispatchUseCase(decisionRepo, tripService, dataSource, eventEmitter);
    await useCase.execute({ requestId: 'req-001', riderId: 'rider-001', choice: 'original' });

    // The manager's createQueryBuilder must have been called with DispatchDecisionEntity
    expect((capturedManager as jest.Mocked<EntityManager>).createQueryBuilder).toHaveBeenCalledWith(
      DispatchDecisionEntity,
      expect.any(String),
    );

    // The query builder must have had pessimistic_write lock set
    const qb = (capturedManager as jest.Mocked<EntityManager>).createQueryBuilder(DispatchDecisionEntity, 'd') as jest.Mocked<SelectQueryBuilder<DispatchDecisionEntity>>;
    expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  it('throws RequestNotFoundError when locked entity is null inside transaction', async () => {
    let capturedManager: EntityManager | undefined;
    const dataSource = {
      transaction: jest.fn().mockImplementationOnce(async (cb: (m: EntityManager) => Promise<unknown>) => {
        capturedManager = makeManager(null) as unknown as EntityManager;
        return cb(capturedManager);
      }),
    } as unknown as jest.Mocked<DataSource>;

    const decisionRepo = makeDecisionRepo();
    const tripService = makeTripService();
    const eventEmitter = makeEventEmitter();

    const useCase = new ConfirmDispatchUseCase(decisionRepo, tripService, dataSource, eventEmitter);
    await expect(useCase.execute({ requestId: 'req-999', riderId: 'rider-001', choice: 'original' })).rejects.toBeInstanceOf(
      RequestNotFoundError,
    );
  });

  it('throws RequestAlreadyConfirmedError when locked entity has tripId set', async () => {
    const confirmedEntity = { ...BASE_ENTITY, tripId: 'existing-trip' };
    let capturedManager: EntityManager | undefined;
    const dataSource = {
      transaction: jest.fn().mockImplementationOnce(async (cb: (m: EntityManager) => Promise<unknown>) => {
        capturedManager = makeManager(confirmedEntity) as unknown as EntityManager;
        return cb(capturedManager);
      }),
    } as unknown as jest.Mocked<DataSource>;

    const decisionRepo = makeDecisionRepo();
    const tripService = makeTripService();
    const eventEmitter = makeEventEmitter();

    const useCase = new ConfirmDispatchUseCase(decisionRepo, tripService, dataSource, eventEmitter);
    await expect(useCase.execute({ requestId: 'req-001', riderId: 'rider-001', choice: 'original' })).rejects.toBeInstanceOf(
      RequestAlreadyConfirmedError,
    );
  });

  it('returns assigned trip on successful confirmation', async () => {
    const dataSource = makeDataSource(BASE_ENTITY);
    const decisionRepo = makeDecisionRepo();
    const tripService = makeTripService();
    const eventEmitter = makeEventEmitter();

    const useCase = new ConfirmDispatchUseCase(decisionRepo, tripService, dataSource, eventEmitter);
    const result = await useCase.execute({ requestId: 'req-001', riderId: 'rider-001', choice: 'original' });

    expect(result.tripId).toBe('trip-uuid-001');
    expect(result.status).toBe('assigned');
  });
});
