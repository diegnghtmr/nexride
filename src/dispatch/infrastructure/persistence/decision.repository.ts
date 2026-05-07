import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
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
      destinationLat: decision.destination.lat,
      destinationLng: decision.destination.lng,
      suggestedPointId: decision.suggestedPointId ?? null,
      suggestedLat: decision.suggestedLocation?.lat ?? null,
      suggestedLng: decision.suggestedLocation?.lng ?? null,
      vehicleId: decision.winnerVehicleId,
      scoresJson: decision.scoresJson,
      fallbackReason: decision.fallbackReason ?? null,
      suggestionStatus: decision.suggestionStatus,
      pipelineDurationMs: decision.pipelineDurationMs,
      tripId: null,
      userChoice: null,
      confirmedAt: null,
    });
    try {
      await this.repo.save(entity);
    } catch (err) {
      // REQ-FIX-V8-01 belt-and-suspenders: if the abort-signal guard in runPipeline slips
      // and the late-arriving pipeline also attempts a savePreliminary, PG rejects the
      // duplicate insert with 23505 unique_violation. We silently no-op here — the first
      // write (fallback row) is the canonical record.
      if (err instanceof QueryFailedError && (err as unknown as { code: string }).code === '23505') {
        return;
      }
      throw err;
    }
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
      destination: {
        lat: entity.destinationLat ?? 0,
        lng: entity.destinationLng ?? 0,
      },
      winnerVehicleId: entity.vehicleId,
      suggestedPointId: entity.suggestedPointId ?? undefined,
      suggestedLocation:
        entity.suggestedLat != null && entity.suggestedLng != null
          ? { lat: entity.suggestedLat, lng: entity.suggestedLng }
          : undefined,
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
