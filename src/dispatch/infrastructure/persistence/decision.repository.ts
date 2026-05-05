import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IDecisionRepository } from '../../../common/interfaces/IDecisionRepository';
import { PreliminaryDecision } from '../../../common/interfaces/shared-types';
import { DispatchDecisionEntity } from './dispatch-decision.entity';

@Injectable()
export class DecisionRepository implements IDecisionRepository {
  constructor(
    @InjectRepository(DispatchDecisionEntity)
    private readonly repo: Repository<DispatchDecisionEntity>,
  ) {}

  async savePreliminary(decision: PreliminaryDecision): Promise<void> {
    const entity = this.repo.create({
      requestId: decision.requestId,
      riderId: decision.riderId,
      originalLat: decision.origin.lat,
      originalLng: decision.origin.lng,
      suggestedPointId: decision.suggestedPointId ?? null,
      vehicleId: decision.winnerVehicleId,
      scoresJson: decision.scoresJson,
      fallbackReason: decision.fallbackReason ?? null,
      suggestionStatus: decision.suggestionStatus,
      pipelineDurationMs: decision.pipelineDurationMs,
      tripId: null,
      userChoice: null,
      confirmedAt: null,
    });
    await this.repo.save(entity);
  }

  async updateConfirmed(requestId: string, tripId: string, userChoice: 'original' | 'suggested'): Promise<void> {
    await this.repo.update(requestId, {
      tripId,
      userChoice,
      confirmedAt: new Date(),
    });
  }

  async findByRequestId(requestId: string): Promise<PreliminaryDecision | null> {
    const entity = await this.repo.findOne({ where: { requestId } });
    if (!entity) return null;

    const decision: PreliminaryDecision & { tripId?: string; userChoice?: string } = {
      requestId: entity.requestId,
      riderId: entity.riderId,
      origin: { lat: entity.originalLat, lng: entity.originalLng },
      destination: { lat: 0, lng: 0 }, // destination not stored in this table
      winnerVehicleId: entity.vehicleId,
      suggestedPointId: entity.suggestedPointId ?? undefined,
      scoresJson: entity.scoresJson,
      fallbackReason: entity.fallbackReason ?? undefined,
      suggestionStatus: entity.suggestionStatus,
      pipelineDurationMs: entity.pipelineDurationMs ?? 0,
      // Include confirmation data so DecisionRecorder can detect duplicates
      tripId: entity.tripId ?? undefined,
      userChoice: entity.userChoice ?? undefined,
    };
    return decision as PreliminaryDecision;
  }
}
