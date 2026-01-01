import { Hono } from 'hono';
import { getSignedFileUrl } from '@/lib/s3';

const mediaRoutes = new Hono();

// GET /uploads/* - Redirect to signed S3 URL
// All media is stored in Wasabi S3 with signed URLs
mediaRoutes.get('/*', async (c) => {
  const url = new URL(c.req.url);
  let path = url.pathname;

  // Remove /uploads/ prefix
  if (path.startsWith('/uploads/')) {
    path = path.slice(9);
  } else if (path.startsWith('/')) {
    path = path.slice(1);
  }

  // Validate path
  if (path.includes('..') || !path) {
    return c.notFound();
  }

  // Generate signed URL and redirect
  const signedUrl = await getSignedFileUrl(path);
  return c.redirect(signedUrl, 302);
});

export { mediaRoutes };
