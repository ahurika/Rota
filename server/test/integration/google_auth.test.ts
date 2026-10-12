import { describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { primaryPool0 } from '../../src/db/shards.js';

describe('Google Authentication Integration Tests', () => {
  it('authenticates and creates user via Google ID token', async () => {
    const testToken = `test_google_token_sam_${Date.now()}`;
    const expectedEmail = `${testToken.replace('test_google_token_', '')}@gmail.com`;

    // 1. Initial Google sign-in
    const res = await app.request('/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: testToken,
        deviceId: 'pixel-9-pro',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.email).toBe(expectedEmail);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');

    // Verify user was stored in database
    const userCheck = await primaryPool0.query(
      'SELECT id, email, token_version FROM users WHERE email = $1',
      [expectedEmail]
    );
    expect(userCheck.rows.length).toBe(1);

    // 2. Second Google sign-in for existing user should reuse account and issue new session
    const res2 = await app.request('/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: testToken,
      }),
    });

    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as any;
    expect(body2.user.id).toBe(userCheck.rows[0].id);

    // 3. Tokens can be rotated seamlessly through standard refresh pipeline
    const refreshRes = await app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: body2.refreshToken,
      }),
    });

    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as any;
    expect(refreshBody).toHaveProperty('accessToken');
    expect(refreshBody).toHaveProperty('refreshToken');
    expect(refreshBody.refreshToken).not.toBe(body2.refreshToken);
  });

  it('rejects malformed requests with 400 validation error', async () => {
    const res = await app.request('/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: 'short', // Fails min 20 check
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });
});
