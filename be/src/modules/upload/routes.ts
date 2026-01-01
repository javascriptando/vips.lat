import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppVariables } from '@/types';
import { requireAuth } from '@/middlewares/auth';
import { uploadRateLimit } from '@/middlewares/rateLimit';
import * as uploadService from './service';

const uploadRoutes = new Hono<{ Variables: AppVariables }>();

const initSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
});

// POST /api/upload/init - Initialize chunked upload
uploadRoutes.post(
  '/init',
  requireAuth,
  uploadRateLimit,
  zValidator('json', initSchema),
  async (c) => {
    try {
      const user = c.get('user')!;
      const { fileName, fileSize, mimeType } = c.req.valid('json');

      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
      ];

      if (!allowedTypes.includes(mimeType)) {
        return c.json({ error: 'Tipo de arquivo não permitido' }, 400);
      }

      // Validate file size (500MB max)
      const maxSize = 500 * 1024 * 1024;
      if (fileSize > maxSize) {
        return c.json({ error: 'Arquivo muito grande (máximo 500MB)' }, 400);
      }

      const result = await uploadService.initUpload(user.id, fileName, fileSize, mimeType);

      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao iniciar upload';
      return c.json({ error: message }, 400);
    }
  }
);

// POST /api/upload/:uploadId/chunk - Upload a chunk
uploadRoutes.post('/:uploadId/chunk', requireAuth, async (c) => {
  try {
    const user = c.get('user')!;
    const uploadId = c.req.param('uploadId');

    const body = await c.req.parseBody();
    const chunkIndex = parseInt(body['chunkIndex'] as string);
    const chunk = body['chunk'] as Blob;

    if (isNaN(chunkIndex) || !chunk) {
      return c.json({ error: 'Dados inválidos' }, 400);
    }

    const result = await uploadService.uploadChunk(uploadId, user.id, chunkIndex, chunk);

    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar chunk';
    return c.json({ error: message }, 400);
  }
});

// POST /api/upload/:uploadId/complete - Complete upload and merge chunks
uploadRoutes.post('/:uploadId/complete', requireAuth, async (c) => {
  try {
    const user = c.get('user')!;
    const uploadId = c.req.param('uploadId');

    const file = await uploadService.completeUpload(uploadId, user.id);

    return c.json({ file });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao completar upload';
    return c.json({ error: message }, 400);
  }
});

// DELETE /api/upload/:uploadId - Cancel upload
uploadRoutes.delete('/:uploadId', requireAuth, async (c) => {
  try {
    const user = c.get('user')!;
    const uploadId = c.req.param('uploadId');

    await uploadService.cancelUpload(uploadId, user.id);

    return c.json({ message: 'Upload cancelado' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao cancelar upload';
    return c.json({ error: message }, 400);
  }
});

export { uploadRoutes };
