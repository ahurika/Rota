import { describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';

describe('Liveness and Health Endpoint', () => {
  it('GET /health returns 200 and status ok with requestId header', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');

    const requestIdHeader = res.headers.get('x-request-id');
    expect(requestIdHeader).toBeTruthy();
  });

  it('Unknown route returns standard 404 error envelope', async () => {
    const res = await app.request('/non-existent-route');
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: { code: string; requestId: string } };
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(body.error).toHaveProperty('requestId');
    expect(typeof body.error.requestId).toBe('string');
  });
});
