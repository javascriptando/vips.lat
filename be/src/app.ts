import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { env } from '@/config/env';
import { authMiddleware } from '@/middlewares/auth';
import { apiRateLimit } from '@/middlewares/rateLimit';
import type { AppVariables } from '@/types';

// Import routes
import { authRoutes } from '@/modules/auth/routes';
import { userRoutes } from '@/modules/users/routes';
import { creatorRoutes } from '@/modules/creators/routes';
import { contentRoutes } from '@/modules/content/routes';
import { subscriptionRoutes } from '@/modules/subscriptions/routes';
import { paymentRoutes } from '@/modules/payments/routes';
import { payoutRoutes } from '@/modules/payouts/routes';
import { webhookRoutes } from '@/modules/payments/webhooks';
import { mediaRoutes } from '@/modules/media/routes';
import { notificationRoutes } from '@/modules/notifications/routes';
import { commentRoutes } from '@/modules/comments/routes';
import { favoriteRoutes } from '@/modules/favorites/routes';
import messageRoutes from '@/modules/messages/routes';
import { analyticsRoutes } from '@/modules/analytics/routes';
import { storyRoutes } from '@/modules/stories/routes';
import { uploadRoutes } from '@/modules/upload/routes';
import packRoutes from '@/modules/packs/routes';
import { secureMediaRoutes } from '@/modules/secureMedia/routes';

// Create Hono app
const app = new Hono<{ Variables: AppVariables }>();

// Global middlewares
app.use('*', logger());

// Secure headers - but not for uploads (allows cross-origin image loading)
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/uploads/')) {
    return next();
  }
  return secureHeaders()(c, next);
});

// CORS for API
app.use('/api/*', cors({
  origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:4000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));

// CORS for uploads (static files) - must allow cross-origin image loading
app.use('/uploads/*', async (c, next) => {
  // Set CORS headers
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // Critical: Allow cross-origin resource loading
  c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  await next();
});

// CORS for secure-media (allows cross-origin image/video loading)
app.use('/api/secure-media/*', async (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  await next();
});

// Auth middleware for API routes (except secure-media which uses token auth)
app.use('/api/*', async (c, next) => {
  // Skip auth middleware for secure-media routes (they use JWT token auth)
  if (c.req.path.startsWith('/api/secure-media')) {
    return next();
  }
  return authMiddleware(c, next);
});

// Rate limiting for API routes
app.use('/api/*', apiRateLimit);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/creators', creatorRoutes);
app.route('/api/content', contentRoutes);
app.route('/api/subscriptions', subscriptionRoutes);
app.route('/api/payments', paymentRoutes);
app.route('/api/payouts', payoutRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/comments', commentRoutes);
app.route('/api/favorites', favoriteRoutes);
app.route('/api/messages', messageRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/stories', storyRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/packs', packRoutes);
app.route('/api/secure-media', secureMediaRoutes);

// Media routes (uploads)
app.route('/uploads', mediaRoutes);

// Webhooks (sem rate limit, sem auth)
app.route('/webhooks', webhookRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Rota não encontrada' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);

  if (err.message.includes('Unauthorized')) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  if (err.message.includes('Forbidden')) {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  return c.json(
    {
      error: env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : err.message,
    },
    500
  );
});

export { app };
