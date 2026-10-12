import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env explicitly and fallback to cwd
loadDotenv({ path: path.resolve(__dirname, '../../.env') });
loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL_0: z.string().default('postgresql://rota:rota_local_only@localhost:5432/rota_shard0'),
  DATABASE_URL_1: z.string().default('postgresql://rota:rota_local_only@localhost:5432/rota_shard1'),
  DATABASE_URL_READ_0: z.string().optional(),
  DATABASE_URL_READ_1: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6380'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev_jwt_access_secret_do_not_use_in_prod_minimum_32_characters'),
  REFRESH_TOKEN_PEPPER: z.string().min(16).default('dev_refresh_token_pepper_minimum_32_characters'),
  PAYMENT_PROVIDER: z.enum(['paystack', 'flutterwave']).default('paystack'),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  FLW_SECRET_KEY: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  SENTRY_DSN_SERVER: z.string().optional(),
  FEED_CACHE_ENABLED: z.coerce.boolean().default(false),
  LOADTEST_MODE: z.coerce.boolean().default(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
