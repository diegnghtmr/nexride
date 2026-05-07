/**
 * Prometheus text-format parser helper for integration tests.
 *
 * Parses the output of GET /metrics and extracts numeric counter values
 * so tests can assert actual increments rather than mere name presence.
 *
 * REQ-FIX-2 (F2)
 */

/**
 * Returns the numeric value for a Prometheus metric line matching the given
 * name and optional label set. Returns 0 when the metric is absent (never throws).
 *
 * @param text   Raw Prometheus text-format output (the response body of GET /metrics)
 * @param name   Metric name (e.g. `dispatch_evaluate_total`)
 * @param labels Optional label key-value pairs to narrow the match
 *               (e.g. `{ outcome: 'success' }`)
 */
export function getCounterValue(text: string, name: string, labels: Record<string, string> = {}): number {
  const labelEntries = Object.entries(labels);

  let pattern: RegExp;
  if (labelEntries.length === 0) {
    // Match a line like: `metric_name 42` (no labels)
    pattern = new RegExp(`^${name}\\s+([\\d.]+)$`, 'm');
  } else {
    // Build escaped label sub-patterns and match a line like:
    // `metric_name{outcome="success"} 1`
    const labelStr = labelEntries.map(([k, v]) => `${k}="${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).join(',');
    pattern = new RegExp(`^${name}\\{[^}]*${labelStr}[^}]*\\}\\s+([\\d.]+)$`, 'm');
  }

  const match = text.match(pattern);
  return match ? parseFloat(match[1]) : 0;
}
