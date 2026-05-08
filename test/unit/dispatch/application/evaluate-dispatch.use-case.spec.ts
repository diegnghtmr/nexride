/**
 * Unit tests for EvaluateDispatchUseCase — Judgment 16° B5 + B1 close.
 *
 * Covers the orchestrator paths the coverage gate previously didn't see:
 *  - happy path: candidates → filter → score → decide → persist → output
 *  - fallback (no_candidates): EMPTY_AFTER_FILTER → fallback → fallback output
 *  - fallback (timeout): pipeline aborts → fallback path
 *  - hard fail: fallback also throws → emits no_availability, throws NoAvailabilityError
 */

import { EventEmitter2 } from '@nestjs/event-emitter';
import { EvaluateDispatchUseCase } from '../../../../src/dispatch/application/evaluate-dispatch.use-case';
import type { CandidateGenerator } from '../../../../src/dispatch/domain/services/candidate-generator';
import type { CandidateFilter } from '../../../../src/dispatch/domain/services/candidate-filter';
import type { ScoringEngine } from '../../../../src/dispatch/domain/services/scoring-engine';
import { DecisionMaker } from '../../../../src/dispatch/domain/services/decision-maker';
import type { FallbackHandler } from '../../../../src/dispatch/domain/services/fallback-handler';
import type { DecisionRecorder } from '../../../../src/dispatch/domain/services/decision-recorder';
import { NoAvailabilityError } from '../../../../src/common/errors/domain-error';
import { DispatchEventName } from '../../../../src/common/events/event-names';
import { loadDispatchConfig } from '../../../../src/common/config/dispatch.config';
import { GeoPoint } from '../../../../src/dispatch/domain/value-objects/geo-point.vo';
import { VehicleCandidate } from '../../../../src/dispatch/domain/entities/vehicle-candidate';

const cfg = loadDispatchConfig({});

function makeVehicle(id = 'veh-1'): VehicleCandidate {
  return new VehicleCandidate({
    id,
    location: GeoPoint.of(4.65, -74.05),
    batteryPct: 80,
    autonomyKm: 60,
    eligibility: 'eligible',
    state: 'available',
    telemetryAt: new Date(),
    distanceFromOriginM: 0,
  });
}

interface UseCaseDeps {
  candidateGenerator: jest.Mocked<Pick<CandidateGenerator, 'generate'>>;
  candidateFilter: jest.Mocked<Pick<CandidateFilter, 'filter'>>;
  scoringEngine: jest.Mocked<Pick<ScoringEngine, 'score'>>;
  decisionMaker: DecisionMaker;
  fallbackHandler: jest.Mocked<Pick<FallbackHandler, 'fallback'>>;
  decisionRecorder: jest.Mocked<Pick<DecisionRecorder, 'savePreliminary'>>;
  eventEmitter: EventEmitter2;
  emitSpy: jest.SpyInstance;
}

function buildDeps(): UseCaseDeps {
  const eventEmitter = new EventEmitter2();
  const emitSpy = jest.spyOn(eventEmitter, 'emit');
  return {
    candidateGenerator: { generate: jest.fn() } as unknown as jest.Mocked<Pick<CandidateGenerator, 'generate'>>,
    candidateFilter: { filter: jest.fn() } as unknown as jest.Mocked<Pick<CandidateFilter, 'filter'>>,
    scoringEngine: { score: jest.fn() } as unknown as jest.Mocked<Pick<ScoringEngine, 'score'>>,
    decisionMaker: new DecisionMaker(cfg),
    fallbackHandler: { fallback: jest.fn() } as unknown as jest.Mocked<Pick<FallbackHandler, 'fallback'>>,
    decisionRecorder: { savePreliminary: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<
      Pick<DecisionRecorder, 'savePreliminary'>
    >,
    eventEmitter,
    emitSpy,
  };
}

function makeUseCase(deps: UseCaseDeps, pipelineTimeoutMs = 1200): EvaluateDispatchUseCase {
  return new EvaluateDispatchUseCase(
    deps.candidateGenerator as unknown as CandidateGenerator,
    deps.candidateFilter as unknown as CandidateFilter,
    deps.scoringEngine as unknown as ScoringEngine,
    deps.decisionMaker,
    deps.fallbackHandler as unknown as FallbackHandler,
    deps.decisionRecorder as unknown as DecisionRecorder,
    deps.eventEmitter,
    pipelineTimeoutMs,
  );
}

const input = {
  riderId: 'rider-1',
  origin: { lat: 4.65, lng: -74.05 },
  destination: { lat: 4.66, lng: -74.06 },
};

describe('EvaluateDispatchUseCase', () => {
  describe('happy path', () => {
    it('runs the full pipeline and persists the preliminary decision', async () => {
      const deps = buildDeps();
      deps.candidateGenerator.generate.mockResolvedValue({ vehicles: [makeVehicle()], safePoints: [] });
      deps.candidateFilter.filter.mockReturnValue({ passed: [makeVehicle()], rejections: [] });
      deps.scoringEngine.score.mockResolvedValue({
        proximity: 0.9,
        energy: 0.8,
        safety: 0.3,
        continuity: 0.7,
        total: 0.7,
        etaSeconds: 120,
        walkingMeters: 0,
      });

      const useCase = makeUseCase(deps);
      const out = await useCase.execute(input);

      expect(out.requestId).toMatch(/[0-9a-f-]{36}/i);
      expect(out.original.vehicleId).toBe('veh-1');
      expect(out.fallback).toBe(false);
      expect(deps.decisionRecorder.savePreliminary).toHaveBeenCalledTimes(1);
      const calls = deps.emitSpy.mock.calls.map((c) => c[0]);
      expect(calls).toContain(DispatchEventName.RequestCreated);
    });
  });

  describe('fallback path (no_candidates)', () => {
    it('falls back when filter empties the candidate list', async () => {
      const deps = buildDeps();
      deps.candidateGenerator.generate.mockResolvedValue({ vehicles: [makeVehicle()], safePoints: [] });
      deps.candidateFilter.filter.mockReturnValue({ passed: [], rejections: [] });
      deps.fallbackHandler.fallback.mockResolvedValue({
        vehicleId: 'veh-fb',
        fallbackReason: 'no_candidates',
        fallbackDistanceKm: 1.5,
      });

      const useCase = makeUseCase(deps);
      const out = await useCase.execute(input);

      expect(out.fallback).toBe(true);
      expect(out.fallbackReason).toBe('no_candidates');
      expect(out.original.vehicleId).toBe('veh-fb');
      expect(deps.fallbackHandler.fallback).toHaveBeenCalledWith(expect.anything(), 'no_candidates');
      const calls = deps.emitSpy.mock.calls.map((c) => c[0]);
      expect(calls).toContain(DispatchEventName.FallbackActivated);
    });
  });

  describe('fallback path (timeout)', () => {
    it('falls back with reason=timeout when pipeline aborts', async () => {
      const deps = buildDeps();
      // Hang candidature longer than the timeout to trigger abort
      deps.candidateGenerator.generate.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ vehicles: [], safePoints: [] }), 80)),
      );
      deps.fallbackHandler.fallback.mockResolvedValue({
        vehicleId: 'veh-fb',
        fallbackReason: 'timeout',
        fallbackDistanceKm: 2,
      });

      const useCase = makeUseCase(deps, 10);
      const out = await useCase.execute(input);

      expect(out.fallback).toBe(true);
      expect(out.fallbackReason).toBe('timeout');
      expect(deps.fallbackHandler.fallback).toHaveBeenCalledWith(expect.anything(), 'timeout');
    });
  });

  describe('hard fail path', () => {
    it('emits no_availability and throws NoAvailabilityError when fallback also fails', async () => {
      const deps = buildDeps();
      deps.candidateGenerator.generate.mockResolvedValue({ vehicles: [], safePoints: [] });
      deps.candidateFilter.filter.mockReturnValue({ passed: [], rejections: [] });
      deps.fallbackHandler.fallback.mockRejectedValue(new NoAvailabilityError('no fallback', { requestId: 'x' }));

      const useCase = makeUseCase(deps);

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(NoAvailabilityError);

      const calls = deps.emitSpy.mock.calls.map((c) => c[0]);
      expect(calls).toContain(DispatchEventName.NoAvailability);
    });
  });
});
