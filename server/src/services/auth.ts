import { v4 as uuidv4 } from 'uuid';
import { usersRepository, UserRow } from '../repositories/usersRepository.js';
import { refreshTokensRepository } from '../repositories/refreshTokensRepository.js';
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashTokenWithPepper,
} from '../lib/crypto.js';
import { signAccessToken } from '../lib/jwt.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getRedisClient } from '../db/shards.js';
import { env } from '../config/env.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: {
    id: string;
    email: string;
  };
}

export const authService = {
  /**
   * Registers a new user with Argon2id password hash and issues initial tokens.
   */
  async register(email: string, plainPassword: string): Promise<AuthResult> {
    const existing = await usersRepository.findByEmail(email);
    if (existing) {
      throw new AppError('CONFLICT', 409, 'User with this email already exists');
    }

    const passwordHash = await hashPassword(plainPassword);
    const user = await usersRepository.create(email, passwordHash);

    const familyId = uuidv4();
    const rawRefreshToken = generateRandomToken(32);
    const tokenHash = hashTokenWithPepper(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await refreshTokensRepository.create({
      userId: user.id,
      familyId,
      tokenHash,
      expiresAt,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      sid: familyId,
      tv: user.token_version,
    });

    return {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  },

  /**
   * Authenticates user credentials without leaking email existence (Rule 01).
   */
  async login(email: string, plainPassword: string, deviceId?: string): Promise<AuthResult> {
    const user = await usersRepository.findByEmail(email);
    if (!user) {
      // Dummy check to mitigate timing enumeration
      await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$placeholderhashplaceholderhash$placeholderhash',
        plainPassword
      ).catch(() => {});
      throw new AppError('UNAUTHORIZED', 401, 'Invalid email or password');
    }

    const valid = await verifyPassword(user.password_hash, plainPassword);
    if (!valid) {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid email or password');
    }

    const familyId = uuidv4();
    const rawRefreshToken = generateRandomToken(32);
    const tokenHash = hashTokenWithPepper(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await refreshTokensRepository.create({
      userId: user.id,
      familyId,
      deviceId,
      tokenHash,
      expiresAt,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      sid: familyId,
      tv: user.token_version,
    });

    return {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  },

  /**
   * Authenticates or creates a user using a verified Google OAuth ID Token.
   */
  async loginWithGoogle(idToken: string, deviceId?: string): Promise<AuthResult> {
    let email: string;

    // Test bypass for deterministic automated tests
    if (env.NODE_ENV === 'test' && idToken.startsWith('test_google_token_')) {
      email = idToken.replace('test_google_token_', '') + '@gmail.com';
    } else {
      let googleData: any;
      try {
        const resp = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (!resp.ok) {
          throw new Error('Google token verification failed');
        }
        googleData = await resp.json();
      } catch (err) {
        throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired Google ID token');
      }

      if (!googleData || !googleData.email) {
        throw new AppError('UNAUTHORIZED', 401, 'Google account missing email address');
      }

      const isVerified = googleData.email_verified === 'true' || googleData.email_verified === true;
      if (!isVerified) {
        throw new AppError('UNAUTHORIZED', 401, 'Google email address is not verified');
      }

      if (env.GOOGLE_CLIENT_ID && googleData.aud !== env.GOOGLE_CLIENT_ID) {
        throw new AppError('UNAUTHORIZED', 401, 'Google ID token audience mismatch');
      }

      email = String(googleData.email).toLowerCase();
    }

    let user = await usersRepository.findByEmail(email);
    if (!user) {
      // Create user with a randomized, unusable password hash so they cannot be accessed via empty/guessed password
      const unusableHash = await hashPassword(generateRandomToken(48));
      user = await usersRepository.create(email, unusableHash);
    }

    const familyId = uuidv4();
    const rawRefreshToken = generateRandomToken(32);
    const tokenHash = hashTokenWithPepper(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await refreshTokensRepository.create({
      userId: user.id,
      familyId,
      deviceId,
      tokenHash,
      expiresAt,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      sid: familyId,
      tv: user.token_version,
    });

    return {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  },

  /**
   * Refreshes access token with atomic rotation and family reuse detection (Proof Test T4).
   */
  async refresh(rawRefreshToken: string, deviceId?: string): Promise<AuthTokens> {
    const tokenHash = hashTokenWithPepper(rawRefreshToken);
    const row = await refreshTokensRepository.findByTokenHash(tokenHash);

    if (!row) {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid refresh token');
    }

    if (row.revoked_at || row.expires_at < new Date()) {
      throw new AppError('UNAUTHORIZED', 401, 'Refresh token has expired or was revoked');
    }

    // Step 5: REUSE DETECTED: Someone replayed a previously used refresh token!
    if (row.used_at !== null) {
      await refreshTokensRepository.revokeFamily(row.family_id);
      logger.warn(
        { userId: row.user_id, familyId: row.family_id },
        'refresh_reuse_detected: revoking entire token family'
      );
      throw new AppError('UNAUTHORIZED', 401, 'Refresh token reuse detected: token family revoked');
    }

    // Step 6: Atomic claim: only one concurrent request can win
    const claimed = await refreshTokensRepository.claimUnusedAtomic(row.id);
    if (!claimed) {
      // Concurrently claimed by another thread -> treat as reuse
      await refreshTokensRepository.revokeFamily(row.family_id);
      logger.warn(
        { userId: row.user_id, familyId: row.family_id },
        'refresh_concurrent_claim_collision: revoking token family'
      );
      throw new AppError('UNAUTHORIZED', 401, 'Refresh token reuse detected: token family revoked');
    }

    // Issue new refresh token in the same family
    const newRawRefreshToken = generateRandomToken(32);
    const newHash = hashTokenWithPepper(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const newRow = await refreshTokensRepository.create({
      userId: row.user_id,
      familyId: row.family_id,
      deviceId: deviceId ?? row.device_id,
      tokenHash: newHash,
      expiresAt,
    });

    await refreshTokensRepository.setReplacedBy(row.id, newRow.id);

    // Step 7: Issue new access token with current user token_version
    const user = await usersRepository.findById(row.user_id);
    const tokenVersion = user?.token_version ?? 0;

    const accessToken = signAccessToken({
      sub: row.user_id,
      sid: row.family_id,
      tv: tokenVersion,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  },

  /**
   * Logs out current device session by revoking the refresh token family.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashTokenWithPepper(rawRefreshToken);
    const row = await refreshTokensRepository.findByTokenHash(tokenHash);
    if (row) {
      await refreshTokensRepository.revokeFamily(row.family_id);
    }
  },

  /**
   * Logs out of all devices by bumping token_version and revoking all families.
   */
  async logoutAll(userId: string): Promise<void> {
    const newTv = await usersRepository.bumpTokenVersion(userId);
    await refreshTokensRepository.revokeAllForUser(userId);

    // Synchronize current token version with Redis
    try {
      const redis = getRedisClient();
      await redis.set(`tv:${userId}`, newTv.toString());
    } catch {
      // Non-fatal: auth middleware falls back to querying database
    }
  },
};
