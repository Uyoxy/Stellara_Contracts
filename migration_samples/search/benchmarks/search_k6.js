import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<100']
  }
};

export default function () {
  const BASE = __ENV.BASE_URL || 'http://localhost:8081';
  let payload = JSON.stringify({ query: 'rust async', from: 0, size: 10 });
  let params = { headers: { 'Content-Type': 'application/json' } };
  let res = http.post(`${BASE}/v1/search`, payload, params);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
