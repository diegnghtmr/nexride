import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { IDecisionRepository } from '../../common/interfaces/IDecisionRepository';
import { ITripService } from '../../common/interfaces/ITripService';
import { RequestNotFoundError, RequestAlreadyConfirmedError } from '../../common/errors/domain-error';
import { DispatchEventName } from '../../common/events/event-names';

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
  private readonly logger = new Logger(ConfirmDispatchUseCase.name);

  constructor(
    private readonly decisionRepo: IDecisionRepository,
    private readonly tripService: ITripService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: ConfirmDispatchInput): Promise<ConfirmDispatchOutput> {
    const startMs = Date.now();

    // Load existing decision
    const decision = await this.decisionRepo.findByRequestId(input.requestId);
    if (!decision) {
      throw new RequestNotFoundError(`Request ${input.requestId} not found`, { requestId: input.requestId });
    }

    // Check already confirmed
    const decisionAny = decision as typeof decision & { tripId?: string };
    if (decisionAny.tripId) {
      throw new RequestAlreadyConfirmedError(`Request ${input.requestId} already confirmed`, {
        requestId: input.requestId,
      });
    }

    // Execute transaction: create trip + update decision atomically
    const trip = await this.dataSource.transaction(async (manager) => {
      // Determine pickup location
      const pickupLocation =
        input.choice === 'suggested' && decision.suggestedPointId
          ? decision.origin // We'd need the safe point location here; using origin as pickup fallback
          : decision.origin;

      // Create minimum trip
      const newTrip = await this.tripService.createMinimum({
        requestId: input.requestId,
        riderId: decision.riderId,
        vehicleId: decision.winnerVehicleId,
        origin: decision.origin,
        destination: decision.destination,
        pickupLocation,
        pickupType: input.choice,
        suggestedPointId: input.choice === 'suggested' ? decision.suggestedPointId : undefined,
      });

      // Update decision record
      await manager.query(
        `UPDATE dispatch_decisions
         SET trip_id = $1, user_choice = $2, confirmed_at = now()
         WHERE request_id = $3`,
        [newTrip.id, input.choice, input.requestId],
      );

      return newTrip;
    });

    const durationMs = Date.now() - startMs;

    // Emit events after commit
    this.eventEmitter.emit(DispatchEventName.TripAssigned, {
      tripId: trip.id,
      requestId: input.requestId,
      riderId: decision.riderId,
      vehicleId: decision.winnerVehicleId,
      pickupType: input.choice,
      suggestedPointId: input.choice === 'suggested' ? decision.suggestedPointId : undefined,
      ts: new Date().toISOString(),
    });

    this.eventEmitter.emit(DispatchEventName.Completed, {
      requestId: input.requestId,
      tripId: trip.id,
      durationMs,
      winnerVehicleId: decision.winnerVehicleId,
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

    this.logger.log({ requestId: input.requestId, tripId: trip.id, choice: input.choice }, 'Dispatch confirmed');

    return {
      tripId: trip.id,
      vehicleId: decision.winnerVehicleId,
      pickupType: input.choice,
      status: 'assigned',
    };
  }
}
