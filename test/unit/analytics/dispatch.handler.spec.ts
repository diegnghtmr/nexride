/**
 * TDD RED: DispatchAnalyticsHandler emits analytics_persist_failures_total counter
 * when analyticsRepo.save rejects.
 *
 * REQ-3 (Scenarios 3.1–3.4) — F7 v0.1.10-mvp
 *
 * These tests FAIL until the counter is wired in T-005 (GREEN commit).
 */
import { Registry, Counter } from 'prom-client';
import { DispatchAnalyticsHandler } from '../../../src/analytics/handlers/dispatch.handler';
import { DispatchEventName } from '../../../src/common/events/event-names';
import { DispatchMetrics } from '../../../src/common/observability/metrics.registry';

/** Returns the numeric value of a Counter for a specific label set by scraping its text output. Returns 0 if absent. */
async function getCounterValue(counter: Counter, labels: Record<string, string>): Promise<number> {
  const text = await counter.get();
  const target = text.values.find((v) => {
    return Object.entries(labels).every(([k, val]) => (v.labels as Record<string, string>)[k] === val);
  });
  return target ? target.value : 0;
}

/** Build a minimal fake DispatchMetrics object with a real Counter on a fresh registry. */
function buildFakeMetrics(registry: Registry): DispatchMetrics {
  const analyticsPersistFailures = new Counter<'event_name'>({
    name: 'analytics_persist_failures_total',
    help: 'Analytics event persist failures (handler catch path)',
    labelNames: ['event_name'],
    registers: [registry],
  });

  // Provide no-op stubs for other required fields
  const noop = {} as never;
  return {
    pipelineDuration: noop,
    phaseDuration: noop,
    candidatesInitial: noop,
    candidatesAfterFilter: noop,
    suggestionTotal: noop,
    fallbackTotal: noop,
    distanceProviderCalls: noop,
    evaluateTotal: noop,
    evaluateDurationMs: noop,
    confirmTotal: noop,
    candidatesCount: noop,
    phaseCandidatureDurationMs: noop,
    phaseFilterDurationMs: noop,
    phaseScoringDurationMs: noop,
    suggestionGenerated: noop,
    suggestionAccepted: noop,
    suggestionRejected: noop,
    fallbackActivated: noop,
    noAvailability: noop,
    scoringWeights: noop,
    analyticsPersistFailures,
  };
}

describe('DispatchAnalyticsHandler — analytics_persist_failures_total (REQ-3, F7)', () => {
  let analyticsRepo: { create: jest.Mock; save: jest.Mock };
  let mockLogger: { warn: jest.Mock; error: jest.Mock; log: jest.Mock; setContext: jest.Mock };
  let registry: Registry;
  let metrics: DispatchMetrics;
  let handler: DispatchAnalyticsHandler;

  beforeEach(() => {
    registry = new Registry();
    metrics = buildFakeMetrics(registry);

    analyticsRepo = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      setContext: jest.fn(),
    };

    handler = new DispatchAnalyticsHandler(
      analyticsRepo as never,
      mockLogger as never,
      metrics,
    );
  });

  describe('Scenario 3.1 — Counter increments on save failure', () => {
    it('increments analytics_persist_failures_total by 1 when save rejects', async () => {
      analyticsRepo.save.mockRejectedValue(new Error('DB down'));

      await handler.onRequestCreated({
        requestId: 'req-1',
        riderId: 'rider-1',
        ts: new Date().toISOString(),
      } as never);

      expect(
        await getCounterValue(metrics.analyticsPersistFailures, {
          event_name: DispatchEventName.RequestCreated,
        }),
      ).toBe(1);
    });

    it('calls logger.warn exactly once when save rejects', async () => {
      analyticsRepo.save.mockRejectedValue(new Error('DB down'));

      await handler.onRequestCreated({
        requestId: 'req-1',
        riderId: 'rider-1',
        ts: new Date().toISOString(),
      } as never);

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 3.2 — Counter does NOT increment on success', () => {
    it('does not increment counter when save succeeds', async () => {
      analyticsRepo.save.mockResolvedValue(undefined);

      await handler.onRequestCreated({
        requestId: 'req-1',
        riderId: 'rider-1',
        ts: new Date().toISOString(),
      } as never);

      expect(
        await getCounterValue(metrics.analyticsPersistFailures, {
          event_name: DispatchEventName.RequestCreated,
        }),
      ).toBe(0);
    });
  });

  describe('Scenario 3.3 — Counter registered at module init', () => {
    it('metric is found in registry before any event fires', () => {
      const found = registry.getSingleMetric('analytics_persist_failures_total');
      expect(found).toBeDefined();
    });
  });

  describe('Scenario 3.4 — Error is swallowed (parent call does not throw)', () => {
    it('does not throw even when save rejects', async () => {
      analyticsRepo.save.mockRejectedValue(new Error('DB down'));

      await expect(
        handler.onRequestCreated({
          requestId: 'req-1',
          riderId: 'rider-1',
          ts: new Date().toISOString(),
        } as never),
      ).resolves.toBeUndefined();
    });
  });
});
