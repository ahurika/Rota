import crypto from 'node:crypto';
import * as argon2 from '@node-rs/argon2';
import { env } from '../config/env.js';

/**
 * Hashes a plaintext password using Argon2id with memory hardness.
 * Source of truth: Rule 01 and auth-and-token-rotation skill.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    algorithm: argon2.Algorithm.Argon2id,
  });
}

/**
 * Verifies a password against an Argon2id hash using constant-time comparison internally.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

/**
 * Generates a cryptographically secure random 32-byte token (base64url encoded).
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Hashes a refresh token with SHA-256 and the server secret pepper.
 * Raw refresh tokens are NEVER stored in the database.
 */
export function hashTokenWithPepper(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token + env.REFRESH_TOKEN_PEPPER)
    .digest('hex');
}

/**
 * Constant-time string comparison to defend against timing attacks.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
