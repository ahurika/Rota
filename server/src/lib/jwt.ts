import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

export interface AccessTokenPayload {
  sub: string; // user id
  sid: string; // token family id
  tv: number;  // token version
}

/**
 * Issues a short-lived 15-minute JWT access token.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
}

/**
 * Verifies and decodes a JWT access token.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    }) as unknown as AccessTokenPayload;

    if (!decoded.sub || !decoded.sid || typeof decoded.tv !== 'number') {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid access token payload');
    }

    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired access token');
  }
}
