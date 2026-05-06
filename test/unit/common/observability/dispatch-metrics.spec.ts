/**
 * TDD RED: DispatchMetrics interface exposes 4 new metrics required by F2.
 *
 * These tests reference the updated DispatchMetrics interface and the
 * createMetricsRegistry factory. They fail (RED) until the metrics are added.
 *
 * REQ-OBS-1, REQ-OBS-2, REQ-OBS-3, REQ-OBS-4, ADR-3
 */
import { createMetricsRegistry } from '../../../../src/common/observability/metrics.registry';

describe('DispatchMetrics — F2 new metrics (REQ-OBS-1..4)', () => {
  let metrics: ReturnType<typeof createMetricsRegistry>['metrics'];

  beforeEach(() => {
    // Use a fresh registry per test to avoid prom-client duplicate-metric errors (ADR-4)
    const { metrics: m } = createMetricsRegistry();
    metrics = m;
  });

  it('exposes evaluateTotal counter with inc({ outcome }) callable', () => {
    expect(metrics.evaluateTotal).toBeDefined();
    expect(() => metrics.evaluateTotal.inc({ outcome: 'success' })).not.toThrow();
    expect(() => metrics.evaluateTotal.inc({ outcome: 'fallback' })).not.toThrow();
  });

  it('exposes evaluateDurationMs histogram with observe(n) callable', () => {
    expect(metrics.evaluateDurationMs).toBeDefined();
    expect(() => metrics.evaluateDurationMs.observe(123)).not.toThrow();
  });

  it('exposes confirmTotal counter with inc({ outcome }) callable', () => {
    expect(metrics.confirmTotal).toBeDefined();
    expect(() => metrics.confirmTotal.inc({ outcome: 'assigned' })).not.toThrow();
    expect(() => metrics.confirmTotal.inc({ outcome: 'not_authorized' })).not.toThrow();
  });

  it('exposes candidatesCount histogram with observe(n) callable', () => {
    expect(metrics.candidatesCount).toBeDefined();
    expect(() => metrics.candidatesCount.observe(5)).not.toThrow();
  });
});
