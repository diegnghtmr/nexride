/**
 * Unit test for MetricsController @SkipThrottle annotation — Judgment 17° F4.
 *
 * Bug: previously @SkipThrottle() was used without args. The decorator's default
 * is { default: true } (see node_modules/@nestjs/throttler/dist/throttler.decorator.js
 * line 27), but our app registers TWO NAMED throttlers ('user' and 'ip') and no
 * 'default' throttler. So the bare decorator was a no-op and /metrics was still
 * subject to rate-limiting — Prometheus scraping bursts could trip the 100/min
 * user throttler during deploys (D-003 incident risk).
 *
 * Fix: @SkipThrottle({ user: true, ip: true }).
 */

import { MetricsController } from '../../../../src/common/observability/metrics.controller';

// THROTTLER_SKIP metadata key prefix from @nestjs/throttler/throttler.constants.js
const THROTTLER_SKIP = 'THROTTLER:SKIP';

describe('MetricsController @SkipThrottle metadata', () => {
  it('skips the user-named throttler on getMetrics', () => {
    const skip = Reflect.getMetadata(`${THROTTLER_SKIP}user`, MetricsController.prototype.getMetrics);
    expect(skip).toBe(true);
  });

  it('skips the ip-named throttler on getMetrics', () => {
    const skip = Reflect.getMetadata(`${THROTTLER_SKIP}ip`, MetricsController.prototype.getMetrics);
    expect(skip).toBe(true);
  });
});
