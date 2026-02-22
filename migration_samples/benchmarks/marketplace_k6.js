import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 200 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500']
  }
};

export default function () {
  const BASE = __ENV.BASE_URL || 'http://localhost:8080';
  let res = http.get(`${BASE}/health`);
  check(res, { 'status is 200': (r) => r.status === 200 });

  // simulate get listing
  let id = Math.floor(Math.random() * 1000);
  res = http.get(`${BASE}/listings/${id}`);
  check(res, { 'get listing 200': (r) => r.status === 200 });
  sleep(1);
}
