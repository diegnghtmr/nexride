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
import { SafePointCandidate } from '../../../../src/dispatch/domain/entities/safe-point-candidate';
import { Score } from '../../../../src/dispatch/domain/value-objects/score.vo';

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

  /**
   * Branch coverage for suggestion-emission paths (judgment 22° F8 close).
   * The happy-path test above uses `safePoints: []` so the suggestion branches
   * never fire. These tests force a non-empty safe-point catalog and assert
   * the SuggestionShown event + suggested option propagation including the
   * `reasonText` from the safe-point catalog (RTF-06).
   */
  describe('suggestion-emission paths (branch coverage)', () => {
    function makeSafePoint(safetyValue: number, lat = 4.6502, lng = -74.0498): SafePointCandidate {
      return new SafePointCandidate({
        id: '11111111-1111-4111-8111-111111111111',
        location: GeoPoint.of(lat, lng),
        safetyScore: Score.of(safetyValue),
        name: 'Portería Norte',
        zoneId: 'zone-pilot',
        reason: 'Iluminación nocturna y vigilancia 24/7',
      });
    }

    it('emits SuggestionShown and propagates catalog reason as reasonText when suggestion fires (RTF-06)', async () => {
      const deps = buildDeps();
      // Vehicle close to origin; safe-point gives the rider a +15% relative safety improvement
      // when measured against the no-safe-point baseline (safety 0.3 vs 0.6 = 100% improvement)
      // and the walking distance is well within 120m.
      deps.candidateGenerator.generate.mockResolvedValue({
        vehicles: [makeVehicle()],
        safePoints: [makeSafePoint(0.95)],
      });
      deps.candidateFilter.filter.mockReturnValue({ passed: [makeVehicle()], rejections: [] });

      // First call: vehicle+null safepoint baseline. Second call: vehicle+safe-point combo.
      deps.scoringEngine.score
        .mockResolvedValueOnce({
          proximity: 0.9,
          energy: 0.8,
          safety: 0.3,
          continuity: 0.7,
          total: 0.55,
          etaSeconds: 120,
          walkingMeters: 0,
        })
        .mockResolvedValueOnce({
          proximity: 0.88,
          energy: 0.8,
          safety: 0.6,
          continuity: 0.7,
          total: 0.72,
          etaSeconds: 130,
          walkingMeters: 60,
        });

      const useCase = makeUseCase(deps);
      const out = await useCase.execute(input);

      expect(out.fallback).toBe(false);
      expect(out.suggested).toBeDefined();
      expect(out.suggested!.reasonText).toBe('Iluminación nocturna y vigilancia 24/7');
      expect(out.suggested!.walkingDistanceM).toBeCloseTo(60, 0);

      const emittedEvents = deps.emitSpy.mock.calls.map((c) => c[0]);
      expect(emittedEvents).toContain(DispatchEventName.SuggestionShown);
    });

    it('does NOT emit SuggestionShown when no safe-point yields ≥15% relative safety improvement', async () => {
      const deps = buildDeps();
      deps.candidateGenerator.generate.mockResolvedValue({
        vehicles: [makeVehicle()],
        safePoints: [makeSafePoint(0.32)], // barely above baseline → < 15% improvement
      });
      deps.candidateFilter.filter.mockReturnValue({ passed: [makeVehicle()], rejections: [] });
      deps.scoringEngine.score
        .mockResolvedValueOnce({
          proximity: 0.9,
          energy: 0.8,
          safety: 0.3,
          continuity: 0.7,
          total: 0.55,
          etaSeconds: 120,
          walkingMeters: 0,
        })
        .mockResolvedValueOnce({
          proximity: 0.88,
          energy: 0.8,
          safety: 0.32,
          continuity: 0.7,
          total: 0.57,
          etaSeconds: 125,
          walkingMeters: 50,
        });

      const useCase = makeUseCase(deps);
      const out = await useCase.execute(input);

      expect(out.suggested).toBeUndefined();
      const emittedEvents = deps.emitSpy.mock.calls.map((c) => c[0]);
      expect(emittedEvents).not.toContain(DispatchEventName.SuggestionShown);
    });
  });
});
