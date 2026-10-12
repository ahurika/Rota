import { Hono } from 'hono';
import { z } from 'zod';
import { authService } from '../services/auth.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

export type AuthVariables = {
  userId: string;
  familyId: string;
};

export const authRouter = new Hono<{ Variables: AuthVariables }>();

// Strict Zod schemas per Rule 01 and auth-and-token-rotation skill
const registerSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(10).max(128),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
    deviceId: z.string().max(255).optional(),
  })
  .strict();

const refreshSchema = z
  .object({
    refreshToken: z.string().min(20).max(512),
    deviceId: z.string().max(255).optional(),
  })
  .strict();

const logoutSchema = z
  .object({
    refreshToken: z.string().min(20).max(512),
  })
  .strict();

const googleAuthSchema = z
  .object({
    idToken: z.string().min(20).max(4096),
    deviceId: z.string().max(255).optional(),
  })
  .strict();

// 1. POST /v1/auth/register
authRouter.post('/register', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
  });

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
  }

  const result = await authService.register(parsed.data.email, parsed.data.password);
  return c.json(result, 201);
});

// 2. POST /v1/auth/login
authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
  });

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
  }

  const result = await authService.login(parsed.data.email, parsed.data.password, parsed.data.deviceId);
  return c.json(result, 200);
});

// 3. POST /v1/auth/google
authRouter.post('/google', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
  });

  const parsed = googleAuthSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
  }

  const result = await authService.loginWithGoogle(parsed.data.idToken, parsed.data.deviceId);
  return c.json(result, 200);
});

// 4. POST /v1/auth/refresh
authRouter.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
  });

  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
  }

  const result = await authService.refresh(parsed.data.refreshToken, parsed.data.deviceId);
  return c.json(result, 200);
});

// 4. POST /v1/auth/logout
authRouter.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError('VALIDATION_FAILED', 400, 'Invalid JSON body');
  });

  const parsed = logoutSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', parsed.error.format());
  }

  await authService.logout(parsed.data.refreshToken);
  return c.json({ success: true }, 200);
});

// 5. POST /v1/auth/logout-all (Requires Bearer token)
authRouter.post('/logout-all', requireAuth(), async (c) => {
  const userId = c.get('userId');
  await authService.logoutAll(userId);
  return c.json({ success: true, message: 'All device sessions revoked' }, 200);
});
