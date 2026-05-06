import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { CandidateGenerator } from '../domain/services/candidate-generator';
import { CandidateFilter } from '../domain/services/candidate-filter';
import { ScoringEngine } from '../domain/services/scoring-engine';
import { DecisionMaker, ScoredCombo } from '../domain/services/decision-maker';
import { FallbackHandler } from '../domain/services/fallback-handler';
import { DecisionRecorder } from '../domain/services/decision-recorder';
import { GeoPoint } from '../domain/value-objects/geo-point.vo';
import { NoAvailabilityError } from '../../common/errors/domain-error';
import { DispatchEventName } from '../../common/events/event-names';

export interface EvaluateDispatchInput {
  riderId: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  correlationId?: string;
}

export interface OriginalOption {
  vehicleId: string;
  etaSeconds: number;
  pickup: { lat: number; lng: number };
  scores: {
    proximity: number;
    energy: number;
    safety: number;
    continuity: number;
    total: number;
  };
}

export interface SuggestedOption {
  safePointId: string;
  walkingDistanceM: number;
  pickup: { lat: number; lng: number };
  reasonText: string;
  scores: {
    proximity: number;
    energy: number;
    safety: number;
    continuity: number;
    total: number;
  };
}

export interface EvaluateDispatchOutput {
  requestId: string;
  original: OriginalOption;
  suggested?: SuggestedOption;
  ttlSeconds: number;
  fallback: boolean;
  fallbackReason?: string;
}

export class EvaluateDispatchUseCase {
  private readonly logger = new Logger(EvaluateDispatchUseCase.name);
  private readonly pipelineTimeoutMs: number;

  constructor(
    private readonly candidateGenerator: CandidateGenerator,
    private readonly candidateFilter: CandidateFilter,
    private readonly scoringEngine: ScoringEngine,
    private readonly decisionMaker: DecisionMaker,
    private readonly fallbackHandler: FallbackHandler,
    private readonly decisionRecorder: DecisionRecorder,
    private readonly eventEmitter: EventEmitter2,
    pipelineTimeoutMs: number = 1200,
  ) {
    this.pipelineTimeoutMs = pipelineTimeoutMs;
  }

  async execute(input: EvaluateDispatchInput): Promise<EvaluateDispatchOutput> {
    const requestId = randomUUID();
    const startMs = Date.now();
    const ts = new Date().toISOString();

    const origin = GeoPoint.of(input.origin.lat, input.origin.lng);
    const destination = GeoPoint.of(input.destination.lat, input.destination.lng);
    const tripDistanceKm = origin.distanceKmHaversine(destination);

    // Emit request_created immediately
    this.eventEmitter.emit(DispatchEventName.RequestCreated, {
      requestId,
      riderId: input.riderId,
      origin: input.origin,
      destination: input.destination,
      ts,
    });

    // Wrap the full pipeline in a timeout race
    const pipelinePromise = this.runPipeline(requestId, input.riderId, origin, destination, tripDistanceKm, startMs);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PIPELINE_TIMEOUT')), this.pipelineTimeoutMs),
    );

    try {
      return await Promise.race([pipelinePromise, timeoutPromise]);
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message === 'PIPELINE_TIMEOUT';
      const fallbackReason = isTimeout ? 'timeout' : 'no_candidates';

      this.logger.warn({ requestId, reason: fallbackReason }, 'Pipeline fallback activated');

      try {
        const fallback = await this.fallbackHandler.fallback(origin, fallbackReason as 'timeout' | 'no_candidates');
        const pipelineDurationMs = Date.now() - startMs;

        this.eventEmitter.emit(DispatchEventName.FallbackActivated, {
          requestId,
          reason: fallbackReason,
          ts: new Date().toISOString(),
        });

        const scoresJson = { fallback: true, reason: fallbackReason, vehicleId: fallback.vehicleId };

        await this.decisionRecorder.savePreliminary({
          requestId,
          riderId: input.riderId,
          origin: input.origin,
          destination: input.destination,
          winnerVehicleId: fallback.vehicleId,
          scoresJson,
          fallbackReason,
          suggestionStatus: 'not_shown',
          pipelineDurationMs,
        });

        return {
          requestId,
          original: {
            vehicleId: fallback.vehicleId,
            etaSeconds: Math.round((fallback.fallbackDistanceKm / 25) * 3600),
            pickup: input.origin,
            scores: { proximity: 0, energy: 0, safety: 0.3, continuity: 0, total: 0 },
          },
          fallback: true,
          fallbackReason,
          ttlSeconds: 60,
        };
      } catch {
        throw new NoAvailabilityError('No viable vehicle available', { requestId });
      }
    }
  }

  private async runPipeline(
    requestId: string,
    riderId: string,
    origin: GeoPoint,
    destination: GeoPoint,
    tripDistanceKm: number,
    startMs: number,
  ): Promise<EvaluateDispatchOutput> {
    // Phase 1: Candidature
    const { vehicles: rawVehicles, safePoints } = await this.candidateGenerator.generate(origin);

    // Phase 2: Filter
    const { passed: filtered } = this.candidateFilter.filter(rawVehicles, tripDistanceKm);

    if (filtered.length === 0) {
      throw new Error('EMPTY_AFTER_FILTER');
    }

    // Phase 3: Scoring — build (vehicle × safePoint|null) matrix
    const scoringInputs = filtered.flatMap((vehicle) => {
      const combos = [
        {
          origin,
          vehicle,
          safePoint: null,
          tripDistanceKm,
          zoneFactor: 0.5,
        },
        ...safePoints.map((sp) => ({
          origin,
          vehicle,
          safePoint: sp,
          tripDistanceKm,
          zoneFactor: 0.5,
        })),
      ];
      return combos;
    });

    const scoreResults = await Promise.all(
      scoringInputs.map(async (inp) => {
        const result = await this.scoringEngine.score(inp);
        const combo: ScoredCombo = {
          vehicleId: inp.vehicle.id,
          safePointId: inp.safePoint?.id ?? null,
          ...result,
        };
        return { combo, safePoint: inp.safePoint };
      }),
    );

    const combos = scoreResults.map((r) => r.combo);
    const safePointMap = new Map(scoreResults.map((r) => [r.combo.safePointId, r.safePoint]));

    // Phase 4: Decision
    const decision = this.decisionMaker.decide(combos);
    const pipelineDurationMs = Date.now() - startMs;

    // Build scores JSON for persistence
    const scoresJson: Record<string, unknown> = {
      candidates: combos.map((c) => ({
        vehicleId: c.vehicleId,
        safePointId: c.safePointId,
        proximity: c.proximity,
        energy: c.energy,
        safety: c.safety,
        continuity: c.continuity,
        total: c.total,
      })),
    };

    const suggestedPointId = decision.suggestion?.safePointId ?? undefined;

    // Resolve the safe-point location so it can be persisted and used at confirm time (REQ-FIX-04)
    const suggestedSafePoint = suggestedPointId ? safePointMap.get(suggestedPointId) : undefined;
    const suggestedLocation = suggestedSafePoint
      ? { lat: suggestedSafePoint.location.lat, lng: suggestedSafePoint.location.lng }
      : undefined;

    // Phase 5: Persist preliminary decision
    await this.decisionRecorder.savePreliminary({
      requestId,
      riderId,
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      winnerVehicleId: decision.primary.vehicleId,
      suggestedPointId,
      suggestedLocation,
      scoresJson,
      suggestionStatus: decision.suggestion ? 'shown' : 'not_shown',
      pipelineDurationMs,
    });

    // Emit suggestion event if applicable
    if (decision.suggestion) {
      const originalCombo = combos.find((c) => c.vehicleId === decision.primary.vehicleId && c.safePointId === null);
      this.eventEmitter.emit(DispatchEventName.SuggestionShown, {
        requestId,
        originalSafety: originalCombo?.safety ?? 0.3,
        suggestedSafety: decision.primary.safety,
        walkingM: decision.suggestion.walkingMeters,
        safePointId: decision.suggestion.safePointId,
      });
    }

    // Build response
    const original: OriginalOption = {
      vehicleId: decision.primary.vehicleId,
      etaSeconds: decision.primary.etaSeconds,
      pickup: { lat: origin.lat, lng: origin.lng },
      scores: {
        proximity: decision.primary.proximity,
        energy: decision.primary.energy,
        safety: decision.primary.safety,
        continuity: decision.primary.continuity,
        total: decision.primary.total,
      },
    };

    let suggested: SuggestedOption | undefined;
    if (decision.suggestion) {
      const sp = safePointMap.get(decision.suggestion.safePointId);
      const bestSafeCombo = combos.find(
        (c) => c.vehicleId === decision.primary.vehicleId && c.safePointId === decision.suggestion!.safePointId,
      );
      suggested = {
        safePointId: decision.suggestion.safePointId,
        walkingDistanceM: decision.suggestion.walkingMeters,
        pickup: sp ? { lat: sp.location.lat, lng: sp.location.lng } : { lat: origin.lat, lng: origin.lng },
        reasonText: 'Mejor iluminación y mayor flujo peatonal',
        scores: {
          proximity: bestSafeCombo?.proximity ?? 0,
          energy: bestSafeCombo?.energy ?? 0,
          safety: bestSafeCombo?.safety ?? 0,
          continuity: bestSafeCombo?.continuity ?? 0,
          total: bestSafeCombo?.total ?? 0,
        },
      };
    }

    return {
      requestId,
      original,
      suggested,
      ttlSeconds: 60,
      fallback: false,
    };
  }
}
