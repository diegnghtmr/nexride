import { EventEmitter2 } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { IDecisionRepository } from '../../common/interfaces/IDecisionRepository';
import { ITripService } from '../../common/interfaces/ITripService';
import {
  RequestNotFoundError,
  RequestAlreadyConfirmedError,
  MissingSuggestedCoordinatesError,
  RequestNotAuthorizedError,
} from '../../common/errors/domain-error';
import { DispatchEventName } from '../../common/events/event-names';
import { DispatchDecisionEntity } from '../infrastructure/persistence/dispatch-decision.entity';

export interface ConfirmDispatchInput {
  requestId: string;
  riderId: string;
  choice: 'original' | 'suggested';
}

export interface ConfirmDispatchOutput {
  tripId: string;
  vehicleId: string;
  pickupType: 'original' | 'suggested';
  status: 'assigned';
}

export class ConfirmDispatchUseCase {
  constructor(
    private readonly decisionRepo: IDecisionRepository,
    private readonly tripService: ITripService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger = new PinoLogger({}),
  ) {}

  async execute(input: ConfirmDispatchInput): Promise<ConfirmDispatchOutput> {
    const startMs = Date.now();

    // Load existing decision for pre-flight check (no lock yet)
    const decision = await this.decisionRepo.findByRequestId(input.requestId);
    if (!decision) {
      throw new RequestNotFoundError(`Request ${input.requestId} not found`, { requestId: input.requestId });
    }

    // REQ-SEC-1: Ownership check before acquiring any lock or transaction slot.
    // Fail fast — do not waste DB resources on unauthorized requests.
    if (decision.riderId !== input.riderId) {
      throw new RequestNotAuthorizedError('rider not authorized for request', {
        requestId: input.requestId,
        riderId: input.riderId,
      });
    }

    // Execute transaction: SELECT FOR UPDATE → idempotency check → create trip → update decision
    const { trip, vehicleId } = await this.dataSource.transaction(async (manager) => {
      // W-5: Acquire pessimistic write lock inside the transaction to prevent
      // double-confirm race conditions. SELECT FOR UPDATE blocks concurrent
      // transactions until this one completes.
      const lockedEntity = await manager
        .createQueryBuilder(DispatchDecisionEntity, 'd')
        .setLock('pessimistic_write')
        .where('d.request_id = :id', { id: input.requestId })
        .getOne();

      if (!lockedEntity) {
        throw new RequestNotFoundError(`Request ${input.requestId} not found`, { requestId: input.requestId });
      }

      // Idempotency check must be inside the lock to prevent races
      if (lockedEntity.tripId) {
        throw new RequestAlreadyConfirmedError(`Request ${input.requestId} already confirmed`, {
          requestId: input.requestId,
        });
      }

      // Determine pickup location (REQ-FIX-04)
      let pickupLocation: (typeof decision)['origin'];
      if (input.choice === 'suggested') {
        if (!decision.suggestedPointId || !decision.suggestedLocation) {
          throw new MissingSuggestedCoordinatesError(
            `Decision ${input.requestId} marked suggested but has no safe-point coordinates`,
            { requestId: input.requestId },
          );
        }
        pickupLocation = decision.suggestedLocation;
      } else {
        pickupLocation = decision.origin;
      }

      // Create minimum trip — pass the transaction's manager so the INSERT
      // happens on the same connection that holds the SELECT FOR UPDATE.
      // Otherwise the FK validation on trips.request_id deadlocks against the
      // row lock on dispatch_decisions.
      const newTrip = await this.tripService.createMinimum(
        {
          requestId: input.requestId,
          riderId: decision.riderId,
          vehicleId: lockedEntity.vehicleId,
          origin: decision.origin,
          destination: decision.destination,
          pickupLocation,
          pickupType: input.choice,
          suggestedPointId: input.choice === 'suggested' ? decision.suggestedPointId : undefined,
        },
        manager,
      );

      // Update decision record within the same transaction connection
      await manager.query(
        `UPDATE dispatch_decisions
         SET trip_id = $1, user_choice = $2, confirmed_at = now()
         WHERE request_id = $3`,
        [newTrip.id, input.choice, input.requestId],
      );

      return { trip: newTrip, vehicleId: lockedEntity.vehicleId };
    });

    const durationMs = Date.now() - startMs;

    // Emit events after commit
    this.eventEmitter.emit(DispatchEventName.TripAssigned, {
      tripId: trip.id,
      requestId: input.requestId,
      riderId: decision.riderId,
      vehicleId,
      pickupType: input.choice,
      suggestedPointId: input.choice === 'suggested' ? decision.suggestedPointId : undefined,
      ts: new Date().toISOString(),
    });

    this.eventEmitter.emit(DispatchEventName.Completed, {
      requestId: input.requestId,
      tripId: trip.id,
      durationMs,
      winnerVehicleId: vehicleId,
      fallback: !!decision.fallbackReason,
    });

    // Emit suggestion accepted/rejected
    if (decision.suggestionStatus === 'shown' && decision.suggestedPointId) {
      if (input.choice === 'suggested') {
        this.eventEmitter.emit(DispatchEventName.SuggestionAccepted, {
          requestId: input.requestId,
          tripId: trip.id,
          safePointId: decision.suggestedPointId,
          ts: new Date().toISOString(),
        });
      } else {
        this.eventEmitter.emit(DispatchEventName.SuggestionRejected, {
          requestId: input.requestId,
          tripId: trip.id,
          safePointId: decision.suggestedPointId,
          ts: new Date().toISOString(),
        });
      }
    }

    this.logger.info({ requestId: input.requestId, tripId: trip.id, choice: input.choice }, 'Dispatch confirmed');

    return {
      tripId: trip.id,
      vehicleId,
      pickupType: input.choice,
      status: 'assigned',
    };
  }
}
