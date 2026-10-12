import { describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';

describe('Settings Synchronization and Field-Level Timestamps', () => {
  const timestamp = Date.now();
  const userEmail = `user_settings_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  it('GET /v1/settings returns default settings with column-level updatedAt timestamps', async () => {
    // 1. Register user
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password }),
    });
    expect(regRes.status).toBe(201);
    const { accessToken } = (await regRes.json()) as any;

    // 2. Fetch default settings
    const getRes = await app.request('/v1/settings', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(getRes.status).toBe(200);
    const { settings } = (await getRes.json()) as any;

    expect(settings.quietStart).toBe('22:00');
    expect(settings.quietEnd).toBe('06:00');
    expect(settings.timezone).toBe('UTC');
    expect(settings.language).toBe('en');
    expect(settings.theme).toBe('system');
    expect(settings.notifTypes).toEqual({
      shift_changes: true,
      swaps: true,
      billing: true,
    });
    expect(settings.updatedAt).toBeDefined();
    expect(settings.updatedAt.quietStart).toBeDefined();
    expect(settings.updatedAt.timezone).toBeDefined();
  });

  it('PATCH /v1/settings updates field and only touches its column-level timestamp', async () => {
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `user_patch_${Date.now()}@example.com`, password }),
    });
    expect(regRes.status).toBe(201);
    const { accessToken } = (await regRes.json()) as any;

    // Get initial settings
    const initialRes = await app.request('/v1/settings', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { settings: initialSettings } = (await initialRes.json()) as any;
    const initialQuietStartUpdated = initialSettings.updatedAt.quietStart;
    const initialThemeUpdated = initialSettings.updatedAt.theme;

    // Wait 50ms so timestamps can advance if modified
    await new Promise((r) => setTimeout(r, 50));

    // Patch quietStart
    const patchRes = await app.request('/v1/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        quietStart: '23:30',
      }),
    });
    expect(patchRes.status).toBe(200);
    const { settings: updated1 } = (await patchRes.json()) as any;

    expect(updated1.quietStart).toBe('23:30');
    expect(new Date(updated1.updatedAt.quietStart).getTime()).toBeGreaterThan(
      new Date(initialQuietStartUpdated).getTime()
    );
    // Theme timestamp should NOT have changed
    expect(updated1.updatedAt.theme).toBe(initialThemeUpdated);

    // Patch theme now
    await new Promise((r) => setTimeout(r, 50));
    const patchThemeRes = await app.request('/v1/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        theme: 'dark',
      }),
    });
    expect(patchThemeRes.status).toBe(200);
    const { settings: updated2 } = (await patchThemeRes.json()) as any;

    expect(updated2.theme).toBe('dark');
    expect(new Date(updated2.updatedAt.theme).getTime()).toBeGreaterThan(
      new Date(initialThemeUpdated).getTime()
    );
    // quietStart timestamp must remain what it was at updated1
    expect(updated2.updatedAt.quietStart).toBe(updated1.updatedAt.quietStart);
  });

  it('PATCH /v1/settings validates timezone and time formats strictly', async () => {
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `user_val_${Date.now()}@example.com`, password }),
    });
    const { accessToken } = (await regRes.json()) as any;

    // Invalid timezone
    const invalidTzRes = await app.request('/v1/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        timezone: 'Mars/Phobos',
      }),
    });
    expect(invalidTzRes.status).toBe(400);

    // Invalid time format
    const invalidTimeRes = await app.request('/v1/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        quietStart: '25:70',
      }),
    });
    expect(invalidTimeRes.status).toBe(400);

    // Valid IANA timezone
    const validTzRes = await app.request('/v1/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        timezone: 'Europe/London',
      }),
    });
    expect(validTzRes.status).toBe(200);
    const { settings } = (await validTzRes.json()) as any;
    expect(settings.timezone).toBe('Europe/London');
  });
});
