import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(7777),

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

  // Asaas - ambas chaves disponíveis, seleção automática por NODE_ENV
  ASAAS_API_KEY_SANDBOX: z.string(),
  ASAAS_API_KEY_PROD: z.string(),
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

// Valores base do schema
const baseEnv = parsed.data;

// Determina ambiente (dev ou prod)
export const isDev = baseEnv.NODE_ENV !== 'production';
export const isProd = baseEnv.NODE_ENV === 'production';

// Exporta env com valores derivados baseados em NODE_ENV
export const env = {
  ...baseEnv,
  // URLs baseadas no ambiente
  PUBLIC_URL: isProd ? 'https://api.vips.lat' : 'http://localhost:7777',
  FRONTEND_URL: isProd ? 'https://vips.lat' : 'http://localhost:3000',
  // Asaas: seleciona chave automaticamente
  ASAAS_API_KEY: isProd ? baseEnv.ASAAS_API_KEY_PROD : baseEnv.ASAAS_API_KEY_SANDBOX,
  ASAAS_SANDBOX: !isProd, // true em dev/test, false em prod
};
