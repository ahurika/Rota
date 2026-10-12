---
name: load-testing-and-observability
description: Use when adding Rota request logging with request ids, job attempt logs, Sentry on app and server, k6 load tests for the activity feed (200 virtual users, before and after caching), seeding test data, and writing the load test report. Self-study topics: k6 and observability.
---

# Observability and load testing

## Observability: the question you must be able to answer

"What happened to this user's payment at 3:14pm?" You answer it by searching logs for the user id and time, finding the request id, and following it through the request, the queued job, the webhook, and the ledger write.

## Server logging (pino, JSON)

Every request logs one line when it finishes:

```json
{ "level":"info", "msg":"request", "requestId":"c3f1...", "userId":"...", "teamId":"...",
  "method":"POST", "route":"/v1/teams/:teamId/billing/change", "status":200, "durationMs":84 }
```

Rules:
- Middleware creates `requestId` (`crypto.randomUUID()`), or accepts a sane incoming `x-request-id`. Return it in the response header and in every error body.
- Use the route **pattern** (`/teams/:teamId/...`), not the raw URL, so logs group well.
- Add `userId` and `teamId` after auth.
- Pass `requestId` into queue job data. Job logs include `jobId`, `queue`, `attempt`, `requestId`, `outcome` (`ok`, `retry`, `failed`), `durationMs`.
- Never log passwords, tokens, signatures, card data, or whole payloads.
- Log level via env. Pretty print only in development.

Money trail logs to add: payment attempt created, webhook received (event id, type), webhook verified or rejected, ledger written (id, amount, type), subscription changed.

## Sentry

- Server and worker: `@sentry/node`, initialise first, capture errors in the error handler and in job failures. Set `release` and `environment`. Scrub request bodies and headers for auth and billing routes (use `beforeSend`).
- App: `@sentry/react-native` with the Expo setup from the current Sentry docs. The DSN goes in `EXPO_PUBLIC_SENTRY_DSN_APP` (a DSN only allows sending events). The Sentry **auth token** for source map upload is a secret: EAS secret only.
- Tag events with `requestId` and user id so a Sentry event links back to logs.
- Cause one deliberate test error on each side and screenshot the issue in Sentry for the README.

## Load testing with k6

k6 is a separate tool (not an npm package). Install it from the official k6 docs for your OS.

### What to test (Task A)

200 virtual users loading the activity feed at once. Report response times **before** and **after** caching.

### Prepare

1. Seed at least 10,000 activity events for one team (`npm run db:seed`). Also seed 200 users who belong to that team (or fewer users sharing tokens, but then say so in the report).
2. Run the server in a production-like mode, locally or on a staging host. Do not hammer a free hosted instance you also use for the demo, and tell the truth in the report about where it ran (machine, region, database location).
3. Rate limits: do not weaken production. Support an env flag that only works when `NODE_ENV !== 'production'`:

```ts
const loadTest = process.env.LOADTEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
// if (loadTest) feed limit = very high
```

4. Tokens: log in each test user once in k6 `setup()` (stagger so the login rate limit does not trip), or create tokens with a seed script and pass them in a JSON file. Access tokens last 15 minutes, so make sure the run is shorter or refresh in the script.

### Script `load-tests/feed.js`

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '2m',  target: 200 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<600'],
  },
};

const BASE = __ENV.BASE_URL;
const TEAM = __ENV.TEAM_ID;

export function setup() {
  // log in or load tokens. return an array of tokens
}

export default function (tokens) {
  const token = tokens[(__VU - 1) % tokens.length];
  const res = http.get(`${BASE}/v1/teams/${TEAM}/activity?limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: 'feed_first_page' },
  });
  check(res, { 'status 200': (r) => r.status === 200, 'has items': (r) => r.json('items') !== undefined });
  sleep(1);
}
```

Also add one scenario that follows `nextCursor` for 3 pages to prove deep pages stay fast.

### Runs

```
# Run A: cache off
FEED_CACHE_ENABLED=false  (restart server)
k6 run -e BASE_URL=http://localhost:3000 -e TEAM_ID=<id> --summary-export=docs/performance/k6-cache-off.json load-tests/feed.js

# Run B: cache on
FEED_CACHE_ENABLED=true   (restart server)
k6 run ... --summary-export=docs/performance/k6-cache-on.json load-tests/feed.js
```

Warm the cache once before Run B or say that the first requests were cold. Run each at least twice and report both if numbers vary.

### Report `load-tests/REPORT.md` (write from real output only)

Include:
1. Environment: machine, Node version, database location, Redis location, number of server instances, pool sizes.
2. Test design: virtual users, duration, endpoint, data size.
3. Results table: requests, requests per second, error rate, p50, p95, p99 for cache off vs cache on.
4. What you observed in the logs during the run (slowest requests, pool waits, Redis latency, errors). Link to log excerpts.
5. What surprised you and what you changed.
6. Limits of the test (single machine, local network, free tier).
7. Next steps.

Never invent numbers. If a run failed, report that.

## Evidence checklist

- [ ] `docs/performance/feed-explain-before.txt` and `feed-explain-after.txt`
- [ ] `docs/performance/k6-cache-off.json` and `k6-cache-on.json`
- [ ] `load-tests/REPORT.md`
- [ ] Sample log lines showing one payment traced by request id
- [ ] Sentry screenshots (server and app)

## Explain-back questions for the human

1. How would you find a user's failed payment from logs?
2. What did the cache change in the numbers, and why?
3. What is the weakest part of your load test?
