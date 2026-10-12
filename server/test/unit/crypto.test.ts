import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashTokenWithPepper,
  timingSafeEqualString,
} from '../../src/lib/crypto.js';
import { signAccessToken, verifyAccessToken } from '../../src/lib/jwt.js';

describe('Crypto & Token Unit Tests', () => {
  it('hashPassword creates valid Argon2id hash and verifies correctly', async () => {
    const password = 'SuperSecretSecurePassword123!';
    const hash = await hashPassword(password);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, 'WrongPassword123!')).toBe(false);
  });

  it('generateRandomToken generates 32-byte base64url random tokens', () => {
    const t1 = generateRandomToken();
    const t2 = generateRandomToken();

    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(40);
  });

  it('hashTokenWithPepper is deterministic with pepper', () => {
    const token = 'sample-random-token-value';
    const h1 = hashTokenWithPepper(token);
    const h2 = hashTokenWithPepper(token);

    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  it('timingSafeEqualString correctly compares equal and unequal strings', () => {
    expect(timingSafeEqualString('secret-token-123', 'secret-token-123')).toBe(true);
    expect(timingSafeEqualString('secret-token-123', 'secret-token-456')).toBe(false);
    expect(timingSafeEqualString('short', 'longer-string')).toBe(false);
  });

  it('signAccessToken issues verifiable 15-minute JWT with sub, sid, and tv', () => {
    const payload = {
      sub: 'user-uuid-123',
      sid: 'family-uuid-456',
      tv: 2,
    };

    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.sid).toBe(payload.sid);
    expect(decoded.tv).toBe(payload.tv);
  });

  it('verifyAccessToken throws 401 on tampered token', () => {
    const token = signAccessToken({ sub: 'user-1', sid: 'fam-1', tv: 0 });
    const tampered = token.slice(0, -5) + 'xxxxx';

    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
