import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppVariables } from '@/types';
import { verifySecureMediaToken, getSecureMediaUrlFromToken } from '@/lib/secureMedia';

const secureMediaRoutes = new Hono<{ Variables: AppVariables }>();

/**
 * GET /api/secure-media/:token
 *
 * Verify the token and redirect to a fresh S3 signed URL.
 * The token itself contains the userId and serves as authentication.
 * No session/cookie required - this allows <img> and <video> tags to work.
 */
secureMediaRoutes.get(
  '/:token',
  zValidator('param', z.object({ token: z.string().min(1) })),
  async (c) => {
    const { token } = c.req.valid('param');

    const result = await getSecureMediaUrlFromToken(token);

    if ('error' in result) {
      return c.json({ error: result.error }, result.status as 401 | 403);
    }

    // Redirect to the fresh S3 signed URL
    // Use 302 (temporary redirect) so browser doesn't cache the redirect
    return c.redirect(result.url, 302);
  }
);

export { secureMediaRoutes };
