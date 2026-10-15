import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '15s', target: 200 },
    { duration: '30s', target: 200 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<600'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const TEAM = __ENV.TEAM_ID || '859a9351-a67e-4a0b-9ab4-c25ac5ef9d95';

export function setup() {
  const loginRes = http.post(
    `${BASE}/v1/auth/login`,
    JSON.stringify({
      email: 'seed_owner_1@example.com',
      password: 'Password123!Secure',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, { 'login status 200': (r) => r.status === 200 });
  const data = loginRes.json();
  return { token: data.accessToken };
}

export default function (data) {
  const token = data.token;

  // 1. First page query
  const res = http.get(`${BASE}/v1/teams/${TEAM}/activity?limit=20`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'feed_first_page' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    'has items': (r) => {
      const json = r.json();
      return json && Array.isArray(json.items) && json.items.length === 20;
    },
  });

  // 2. Second page query via keyset cursor
  const json = res.json();
  if (json && json.nextCursor) {
    const page2Res = http.get(
      `${BASE}/v1/teams/${TEAM}/activity?cursor=${encodeURIComponent(json.nextCursor)}&limit=20`,
      {
        headers: { Authorization: `Bearer ${token}` },
        tags: { name: 'feed_second_page' },
      }
    );
    check(page2Res, { 'page2 status 200': (r) => r.status === 200 });
  }

  sleep(0.5);
}
