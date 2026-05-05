/**
 * k6 Performance Smoke Test — POST /rides/request
 *
 * CI thresholds: p95<800ms, p99<1500ms (CI-lenient).
 * Production target: p99<1200ms (documented in SCOPE.md under ADR-004).
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
    // p95 hard gate (NFR-01)
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    // Less than 1% error rate
    http_req_failed: ['rate<0.01'],
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
