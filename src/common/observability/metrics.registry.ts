import { Registry, Histogram, Counter } from 'prom-client';

const PIPELINE_BUCKETS = [25, 50, 100, 200, 400, 800, 1200, 2000];

export interface DispatchMetrics {
  pipelineDuration: Histogram;
  phaseDuration: Histogram;
  candidatesInitial: Histogram;
  candidatesAfterFilter: Histogram;
  suggestionTotal: Counter;
  fallbackTotal: Counter;
  distanceProviderCalls: Counter;
}

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
    },
  };
}
