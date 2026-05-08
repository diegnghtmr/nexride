/**
 * k6 Performance Smoke Test — POST /rides/request
 *
 * CI thresholds: p95<800ms, p99<1200ms — aligned with NFR-01 (TRD §7.1).
 * Measured p99 ~14ms in CI smoke run → 85× margin.
 *
 * Usage:
 *   k6 run test/performance/rides-request.k6.js
 *   BASE_URL=http://localhost:3000 k6 run test/performance/rides-request.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    // p95 and p99 hard gates aligned with NFR-01 (TRD §7.1: p95≤800ms, p99≤1200ms)
    http_req_duration: ['p(95)<800', 'p(99)<1200'],
    // Less than 1% error rate
    http_req_failed: ['rate<0.01'],
    // Judgment 16° B3: response-shape checks must pass at 100%. Without this, a
    // 500 with ok latency would pass http_req_duration silently — the gate would
    // only catch slow responses, not wrong ones.
    'checks{check:201 status}': ['rate==1.0'],
    'checks{check:has requestId}': ['rate==1.0'],
    'checks{check:has original}': ['rate==1.0'],
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';

  const payload = JSON.stringify({
    origin: { lat: 4.65, lng: -74.05 },
    destination: { lat: 4.66, lng: -74.06 },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-test-rider-id': `rider-perf-${__VU}`,
      'x-test-rider-role': 'rider',
    },
    timeout: '5s',
  };

  const res = http.post(`${baseUrl}/rides/request`, payload, params);

  check(res, {
    '201 status': (r) => r.status === 201,
    'has requestId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.requestId === 'string' && body.requestId.length > 0;
      } catch {
        return false;
      }
    },
    'has original': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.original === 'object' && body.original !== null;
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}
