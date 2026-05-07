import { Registry, Histogram, Counter, Gauge } from 'prom-client';

const PIPELINE_BUCKETS = [25, 50, 100, 200, 400, 800, 1200, 2000];

let cached: { registry: Registry; metrics: DispatchMetrics } | null = null;

export function getOrCreateMetricsRegistry(): { registry: Registry; metrics: DispatchMetrics } {
  if (!cached) cached = createMetricsRegistry();
  return cached;
}

/** Test helper — pairs with prom-client's register.clear() in beforeAll (ADR-4). */
export function resetMetricsRegistry(): void {
  cached = null;
}

// Bucket sets for F2 metrics (ADR-3)
const EVALUATE_DURATION_BUCKETS = [10, 50, 100, 200, 400, 800];
const CANDIDATES_COUNT_BUCKETS = [0, 1, 2, 5, 10, 20, 50];

export interface DispatchMetrics {
  pipelineDuration: Histogram;
  phaseDuration: Histogram;
  candidatesInitial: Histogram;
  candidatesAfterFilter: Histogram;
  suggestionTotal: Counter;
  fallbackTotal: Counter;
  distanceProviderCalls: Counter;
  // F2 metrics — REQ-OBS-1..4
  evaluateTotal: Counter;
  evaluateDurationMs: Histogram;
  confirmTotal: Counter;
  candidatesCount: Histogram;
  // F3 metrics — DD-02 §14 contract (ADR-v7-03: additive, no renames)
  // DD-02 §14 mapping:
  //   dispatch.phase.candidature.duration_ms → dispatch_phase_candidature_duration_ms
  //   dispatch.phase.filter.duration_ms      → dispatch_phase_filter_duration_ms
  //   dispatch.phase.scoring.duration_ms     → dispatch_phase_scoring_duration_ms
  //   dispatch.suggestion.generated          → dispatch_suggestion_generated
  //   dispatch.suggestion.accepted           → dispatch_suggestion_accepted
  //   dispatch.suggestion.rejected           → dispatch_suggestion_rejected
  //   dispatch.fallback.activated            → dispatch_fallback_activated  (extra label-free; dispatch_fallback_total{reason} kept for overlap)
  //   dispatch.no_availability               → dispatch_no_availability
  //   dispatch.scoring_weights               → dispatch_scoring_weights{weight}
  phaseCandidatureDurationMs: Histogram;
  phaseFilterDurationMs: Histogram;
  phaseScoringDurationMs: Histogram;
  suggestionGenerated: Counter;
  suggestionAccepted: Counter;
  suggestionRejected: Counter;
  fallbackActivated: Counter;
  noAvailability: Counter;
  scoringWeights: Gauge;
}

// ADR-v7-03: F3 metric additions are ADDITIVE — existing metric names are NOT renamed.
// DD-02 §14 compliance is achieved by adding new metrics alongside the existing ones.
// This preserves backward compatibility for existing integration tests.
export function createMetricsRegistry(): { registry: Registry; metrics: DispatchMetrics } {
  const registry = new Registry();

  const pipelineDuration = new Histogram({
    name: 'dispatch_pipeline_duration_ms',
    help: 'Total dispatch pipeline latency in milliseconds',
    labelNames: ['outcome'],
    buckets: PIPELINE_BUCKETS,
    registers: [registry],
  });

  const phaseDuration = new Histogram({
    name: 'dispatch_phase_duration_ms',
    help: 'Per-phase dispatch latency in milliseconds',
    labelNames: ['phase'],
    buckets: PIPELINE_BUCKETS,
    registers: [registry],
  });

  const candidatesInitial = new Histogram({
    name: 'dispatch_candidates_initial',
    help: 'Number of candidates before filtering',
    labelNames: ['zone'],
    buckets: [0, 1, 5, 10, 20, 50, 100],
    registers: [registry],
  });

  const candidatesAfterFilter = new Histogram({
    name: 'dispatch_candidates_after_filter',
    help: 'Number of candidates after filtering',
    labelNames: ['zone'],
    buckets: [0, 1, 5, 10, 20, 50, 100],
    registers: [registry],
  });

  const suggestionTotal = new Counter({
    name: 'dispatch_suggestion_total',
    help: 'Dispatch suggestion outcomes',
    labelNames: ['outcome'],
    registers: [registry],
  });

  const fallbackTotal = new Counter({
    name: 'dispatch_fallback_total',
    help: 'Dispatch fallback activations',
    labelNames: ['reason'],
    registers: [registry],
  });

  const distanceProviderCalls = new Counter({
    name: 'distance_provider_calls_total',
    help: 'Distance provider call results',
    labelNames: ['result'],
    registers: [registry],
  });

  // F2 metrics (REQ-OBS-1..4, ADR-3)
  const evaluateTotal = new Counter({
    name: 'dispatch_evaluate_total',
    help: 'Dispatch evaluate outcomes',
    labelNames: ['outcome'],
    registers: [registry],
  });

  const evaluateDurationMs = new Histogram({
    name: 'dispatch_evaluate_duration_ms',
    help: 'Dispatch evaluate pipeline duration in milliseconds',
    buckets: EVALUATE_DURATION_BUCKETS,
    registers: [registry],
  });

  const confirmTotal = new Counter({
    name: 'dispatch_confirm_total',
    help: 'Dispatch confirm outcomes',
    labelNames: ['outcome'],
    registers: [registry],
  });

  const candidatesCount = new Histogram({
    name: 'dispatch_candidates_count',
    help: 'Number of candidate vehicles per dispatch evaluation',
    buckets: CANDIDATES_COUNT_BUCKETS,
    registers: [registry],
  });

  // F3 metrics — DD-02 §14 contract additions (ADR-v7-03)
  const phaseCandidatureDurationMs = new Histogram({
    name: 'dispatch_phase_candidature_duration_ms',
    help: 'Candidature phase duration in milliseconds',
    buckets: PIPELINE_BUCKETS,
    registers: [registry],
  });

  const phaseFilterDurationMs = new Histogram({
    name: 'dispatch_phase_filter_duration_ms',
    help: 'Filter phase duration in milliseconds',
    buckets: PIPELINE_BUCKETS,
    registers: [registry],
  });

  const phaseScoringDurationMs = new Histogram({
    name: 'dispatch_phase_scoring_duration_ms',
    help: 'Scoring phase duration in milliseconds',
    buckets: PIPELINE_BUCKETS,
    registers: [registry],
  });

  const suggestionGenerated = new Counter({
    name: 'dispatch_suggestion_generated',
    help: 'Number of dispatch suggestions generated',
    registers: [registry],
  });

  const suggestionAccepted = new Counter({
    name: 'dispatch_suggestion_accepted',
    help: 'Number of dispatch suggestions accepted by rider',
    registers: [registry],
  });

  const suggestionRejected = new Counter({
    name: 'dispatch_suggestion_rejected',
    help: 'Number of dispatch suggestions rejected by rider',
    registers: [registry],
  });

  const fallbackActivated = new Counter({
    name: 'dispatch_fallback_activated',
    help: 'Number of dispatch fallback activations (label-free; dispatch_fallback_total{reason} maintained for overlap)',
    registers: [registry],
  });

  const noAvailability = new Counter({
    name: 'dispatch_no_availability',
    help: 'Number of dispatch requests with no viable vehicles',
    registers: [registry],
  });

  const scoringWeights = new Gauge({
    name: 'dispatch_scoring_weights',
    help: 'Dispatch scoring weight values by weight name',
    labelNames: ['weight'],
    registers: [registry],
  });

  return {
    registry,
    metrics: {
      pipelineDuration,
      phaseDuration,
      candidatesInitial,
      candidatesAfterFilter,
      suggestionTotal,
      fallbackTotal,
      distanceProviderCalls,
      evaluateTotal,
      evaluateDurationMs,
      confirmTotal,
      candidatesCount,
      // F3 metrics
      phaseCandidatureDurationMs,
      phaseFilterDurationMs,
      phaseScoringDurationMs,
      suggestionGenerated,
      suggestionAccepted,
      suggestionRejected,
      fallbackActivated,
      noAvailability,
      scoringWeights,
    },
  };
}
