import type { Context, Next } from 'hono';
import { checkRateLimit } from '@/lib/redis';

interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyPrefix?: string;
}

export function rateLimit(options: RateLimitOptions) {
  const { limit, windowSeconds, keyPrefix = 'api' } = options;

  return async (c: Context, next: Next) => {
    // Usar IP como chave (ou user ID se autenticado)
    const user = c.get('user');
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
               c.req.header('x-real-ip') ||
               'unknown';

    const key = user ? `user:${user.id}` : `ip:${ip}`;
    const fullKey = `${keyPrefix}:${key}`;

    const result = await checkRateLimit(fullKey, limit, windowSeconds);

    // Adicionar headers de rate limit
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', result.resetAt.toString());

    if (!result.allowed) {
      return c.json(
        {
          error: 'Muitas requisições. Tente novamente mais tarde.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        429
      );
    }

    return next();
  };
}

// Rate limits pré-configurados
// Valores mais altos para desenvolvimento
const isDev = process.env.NODE_ENV === 'development';

export const apiRateLimit = rateLimit({
  limit: isDev ? 1000 : 100,
  windowSeconds: 60,
  keyPrefix: 'api',
});

export const authRateLimit = rateLimit({
  limit: isDev ? 100 : 10,
  windowSeconds: isDev ? 60 : 60 * 15, // 1 min em dev, 15 min em prod
  keyPrefix: 'auth',
});

export const uploadRateLimit = rateLimit({
  limit: isDev ? 100 : 10,
  windowSeconds: 60,
  keyPrefix: 'upload',
});

export const paymentRateLimit = rateLimit({
  limit: isDev ? 100 : 10,
  windowSeconds: 60,
  keyPrefix: 'payment',
});
