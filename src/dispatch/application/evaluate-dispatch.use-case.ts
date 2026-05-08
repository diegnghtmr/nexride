import { EventEmitter2 } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { DispatchMetrics } from '../../common/observability/metrics.registry';
import { CandidateGenerator } from '../domain/services/candidate-generator';
import { CandidateFilter } from '../domain/services/candidate-filter';
import { ScoringEngine } from '../domain/services/scoring-engine';
import { DecisionMaker, ScoredCombo } from '../domain/services/decision-maker';
import { FallbackHandler } from '../domain/services/fallback-handler';
import { DecisionRecorder } from '../domain/services/decision-recorder';
import { GeoPoint } from '../domain/value-objects/geo-point.vo';
import { NoAvailabilityError } from '../../common/errors/domain-error';
import { DispatchEventName } from '../../common/events/event-names';
import { NoAvailabilityPayload } from '../../common/events/event-payloads';

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
    private readonly logger: PinoLogger = new PinoLogger({}),
    private readonly metrics?: DispatchMetrics,
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

    // REQ-FIX-V8-01: Replace Promise.race with AbortController so the losing pipeline
    // coroutine is signalled to stop before it can write a second dispatch_decisions row.
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(new Error('PIPELINE_TIMEOUT')), this.pipelineTimeoutMs);

    try {
      const result = await this.runPipeline(
        requestId,
        input.riderId,
        origin,
        destination,
        tripDistanceKm,
        startMs,
        controller.signal,
      );
      clearTimeout(timeoutHandle);
      const successDurationMs = Date.now() - startMs;
      // REQ-OBS-1: emit evaluate success counter
      this.metrics?.evaluateTotal.inc({ outcome: 'success' });
      // REQ-OBS-2: emit evaluate duration histogram
      this.metrics?.evaluateDurationMs.observe(successDurationMs);
      // F6 REQ-FIX-V8-06: wire pipelineDuration alongside evaluateDurationMs
      this.metrics?.pipelineDuration.observe({ outcome: 'success' }, successDurationMs);
      return result;
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      const isTimeout = controller.signal.aborted || (err instanceof Error && err.message === 'PIPELINE_TIMEOUT');
      const fallbackReason = isTimeout ? 'timeout' : 'no_candidates';

      this.logger.warn({ requestId, reason: fallbackReason }, 'Pipeline fallback activated');

      try {
        const fallback = await this.fallbackHandler.fallback(origin, fallbackReason as 'timeout' | 'no_candidates');
        const pipelineDurationMs = Date.now() - startMs;

        this.eventEmitter.emit(DispatchEventName.FallbackActivated, {
          requestId,
          riderId: input.riderId,
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

        // REQ-OBS-1: emit fallback counter and duration
        this.metrics?.evaluateTotal.inc({ outcome: 'fallback' });
        this.metrics?.evaluateDurationMs.observe(pipelineDurationMs);
        // F3: fallback activated counter (label-free)
        this.metrics?.fallbackActivated.inc();
        // F6 REQ-FIX-V8-06: wire pipelineDuration (outcome='fallback') and fallbackTotal{reason}
        this.metrics?.pipelineDuration.observe({ outcome: 'fallback' }, pipelineDurationMs);
        this.metrics?.fallbackTotal.inc({ reason: fallbackReason });

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
        // Emit no_availability event before throwing (F8 — application layer, NOT domain)
        const noAvailabilityPayload: NoAvailabilityPayload = {
          requestId,
          riderId: input.riderId,
          reason: 'no_candidates_after_fallback',
          ts: new Date().toISOString(),
        };
        this.eventEmitter.emit(DispatchEventName.NoAvailability, noAvailabilityPayload);
        this.metrics?.noAvailability.inc();
        throw new NoAvailabilityError('No viable vehicle available', { requestId });
      }
    }
  }

  /**
   * REQ-FIX-V8-01: Returns a sentinel value when the pipeline is aborted mid-flight.
   * The caller (execute) will see this as the pipeline "result" but the outer catch
   * block (which runs the fallback) is already in progress — so this sentinel is never
   * returned to the HTTP layer. It serves only to cleanly exit runPipeline without
   * throwing, which would pollute the error logs with false-positive errors.
   */
  private earlyAbortSentinel(): never {
    // Throwing PIPELINE_ABORTED signals to execute() that the pipeline was cleanly cancelled.
    // execute() treats any thrown error while signal.aborted===true as the timeout path.
    throw new Error('PIPELINE_ABORTED');
  }

  private async runPipeline(
    requestId: string,
    riderId: string,
    origin: GeoPoint,
    destination: GeoPoint,
    tripDistanceKm: number,
    startMs: number,
    signal: AbortSignal,
  ): Promise<EvaluateDispatchOutput> {
    // Phase 1: Candidature
    const candidatureStart = Date.now();
    const { vehicles: rawVehicles, safePoints } = await this.candidateGenerator.generate(origin);
    const candidatureDurationMs = Date.now() - candidatureStart;
    this.metrics?.phaseCandidatureDurationMs.observe(candidatureDurationMs);
    // F6 REQ-FIX-V8-06: wire phaseDuration{phase:'candidature'} alongside per-phase histogram
    this.metrics?.phaseDuration.observe({ phase: 'candidature' }, candidatureDurationMs);
    // F6 REQ-FIX-V8-06: wire candidatesInitial after generate()
    this.metrics?.candidatesInitial.observe({ zone: 'default' }, rawVehicles.length);

    // REQ-FIX-V8-01: abort guard after Phase 1 — pipeline may have timed out while awaiting candidature
    if (signal.aborted) return this.earlyAbortSentinel();

    // Phase 2: Filter
    const filterStart = Date.now();
    const { passed: filtered } = this.candidateFilter.filter(rawVehicles, tripDistanceKm);
    const filterDurationMs = Date.now() - filterStart;
    this.metrics?.phaseFilterDurationMs.observe(filterDurationMs);
    // F6 REQ-FIX-V8-06: wire phaseDuration{phase:'filter'} alongside per-phase histogram
    this.metrics?.phaseDuration.observe({ phase: 'filter' }, filterDurationMs);

    // REQ-OBS-4: record candidate count post-filter
    this.metrics?.candidatesCount.observe(filtered.length);
    // F6 REQ-FIX-V8-06: wire candidatesAfterFilter{zone} after filter()
    this.metrics?.candidatesAfterFilter.observe({ zone: 'default' }, filtered.length);

    if (filtered.length === 0) {
      throw new Error('EMPTY_AFTER_FILTER');
    }

    // Phase 3: Scoring — build (vehicle × safePoint|null) matrix
    const scoringStart = Date.now();
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
        const result = await this.scoringEngine.score(inp, signal);
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
    const scoringDurationMs = Date.now() - scoringStart;
    this.metrics?.phaseScoringDurationMs.observe(scoringDurationMs);
    // F6 REQ-FIX-V8-06: wire phaseDuration{phase:'scoring'} alongside per-phase histogram
    this.metrics?.phaseDuration.observe({ phase: 'scoring' }, scoringDurationMs);

    // REQ-FIX-V8-01: abort guard after Phase 3 scoring
    if (signal.aborted) return this.earlyAbortSentinel();

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

    // REQ-FIX-V8-01: CRITICAL abort guard before savePreliminary — this is the race condition write site.
    // If the signal fired, the fallback handler has already written (or is writing) the row.
    // We must bail here to prevent a second INSERT on dispatch_decisions.request_id (PK).
    if (signal.aborted) return this.earlyAbortSentinel();

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

    // REQ-FIX-V8-03: Lift originalCombo find outside the `if (decision.suggestion)` block
    // so it is available for the `original` construction even when no suggestion fires.
    // When a safepoint combo wins, decision.primary IS the safepoint combo — reading scores from it
    // violates the API contract that `original` represents the unmodified baseline.
    const originalCombo =
      combos.find((c) => c.vehicleId === decision.primary.vehicleId && c.safePointId === null) ?? decision.primary;

    if (originalCombo === decision.primary && decision.suggestion) {
      this.logger.warn(
        { requestId, vehicleId: decision.primary.vehicleId },
        'originalCombo not found — falling back to decision.primary for original.scores',
      );
    }

    // Emit suggestion event if applicable
    if (decision.suggestion) {
      this.metrics?.suggestionGenerated.inc();
      // F6 REQ-FIX-V8-06: wire suggestionTotal{outcome:'generated'} alongside label-free counter
      this.metrics?.suggestionTotal.inc({ outcome: 'generated' });
      this.eventEmitter.emit(DispatchEventName.SuggestionShown, {
        requestId,
        riderId,
        originalSafety: originalCombo.safety,
        suggestedSafety: decision.primary.safety,
        walkingM: decision.suggestion.walkingMeters,
        safePointId: decision.suggestion.safePointId,
      });
    }

    // Build response — original uses baseline (no-safepoint) combo scores (REQ-FIX-V8-03)
    // etaSeconds for original also comes from originalCombo: it is the eta to the rider's
    // actual origin, not the safepoint location (ADR-v8-03 F2 also affects etaSeconds).
    const original: OriginalOption = {
      vehicleId: decision.primary.vehicleId,
      etaSeconds: originalCombo.etaSeconds,
      pickup: { lat: origin.lat, lng: origin.lng },
      scores: {
        proximity: originalCombo.proximity,
        energy: originalCombo.energy,
        safety: originalCombo.safety,
        continuity: originalCombo.continuity,
        total: originalCombo.total,
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
