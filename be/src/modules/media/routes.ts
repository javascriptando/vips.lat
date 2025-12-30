import { Hono } from 'hono';
import { join } from 'node:path';
import { env } from '@/config/env';

const mediaRoutes = new Hono();

const UPLOAD_DIR = env.UPLOAD_DIR;

// GET /uploads/* - Servir arquivos de mídia
mediaRoutes.get('/*', async (c) => {
  // Get the path from URL, removing the /uploads prefix
  const url = new URL(c.req.url);
  let path = url.pathname;

  // Remove /uploads/ prefix
  if (path.startsWith('/uploads/')) {
    path = path.slice(9); // Remove '/uploads/'
  } else if (path.startsWith('/')) {
    path = path.slice(1);
  }

  // Validar path para evitar directory traversal
  if (path.includes('..') || !path) {
    return c.notFound();
  }

  const fullPath = join(UPLOAD_DIR, path);

  try {
    const file = Bun.file(fullPath);

    if (!await file.exists()) {
      return c.notFound();
    }

    return new Response(file, {
      headers: {
        'Content-Type': file.type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch {
    return c.notFound();
  }
});

export { mediaRoutes };
