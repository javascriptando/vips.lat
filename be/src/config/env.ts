import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(7777),
  PUBLIC_URL: z.string().default('http://localhost:7777'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Storage
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(500),

  // S3 (Wasabi)
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET: z.string(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string(),

  // Asaas
  ASAAS_API_KEY: z.string(),
  ASAAS_SANDBOX: z.coerce.boolean().default(false),
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().default('noreply@vips.lat'),

  // Auth
  SESSION_SECRET: z.string().min(32),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
