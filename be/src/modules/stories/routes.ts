import { Hono } from 'hono';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import * as storyService from './service';
import { uploadFile } from '@/lib/storage';

const storyRoutes = new Hono<{ Variables: AppVariables }>();

// GET /api/stories - Get stories from followed creators
storyRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  const stories = await storyService.getStoriesFromFollowedCreators(user.id);
  return c.json({ stories });
});

// GET /api/stories/me - Get my own stories (creator only)
storyRoutes.get('/me', requireCreator, async (c) => {
  const creator = c.get('creator')!;
  const stories = await storyService.getActiveStoriesByCreator(creator.id);
  return c.json({ stories });
});

// GET /api/stories/creator/:creatorId - Get stories from a specific creator
storyRoutes.get('/creator/:creatorId', async (c) => {
  const creatorId = c.req.param('creatorId');
  const stories = await storyService.getActiveStoriesByCreator(creatorId);
  return c.json({ stories });
});

// POST /api/stories - Create a new story with pre-uploaded media (creator only)
storyRoutes.post('/', requireCreator, async (c) => {
  const creator = c.get('creator')!;
  const contentType = c.req.header('Content-Type') || '';

  try {
    // Check if it's JSON (pre-uploaded media) or FormData (direct upload)
    if (contentType.includes('application/json')) {
      // Pre-uploaded media via chunked upload
      const body = await c.req.json();
      const { mediaUrl, mediaType, text } = body;

      if (!mediaUrl || !mediaType) {
        return c.json({ error: 'URL e tipo de mídia são obrigatórios' }, 400);
      }

      if (!['image', 'video'].includes(mediaType)) {
        return c.json({ error: 'Tipo de mídia inválido' }, 400);
      }

      const story = await storyService.createStory(creator.id, {
        mediaUrl,
        mediaType,
        thumbnailUrl: undefined,
        text: text || undefined,
      });

      return c.json({ message: 'Story criado com sucesso', story }, 201);
    }

    // FormData - direct file upload (legacy/fallback)
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string | null;

    if (!file) {
      return c.json({ error: 'Arquivo é obrigatório' }, 400);
    }

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return c.json({ error: 'Tipo de arquivo não suportado' }, 400);
    }

    // Save file using existing upload function
    const mediaType = isVideo ? 'video' : 'image';
    const result = await uploadFile(file, mediaType, creator.id);

    const story = await storyService.createStory(creator.id, {
      mediaUrl: result.url,
      mediaType: mediaType,
      thumbnailUrl: undefined,
      text: text || undefined,
    });

    return c.json({ message: 'Story criado com sucesso', story }, 201);
  } catch (error) {
    console.error('Error creating story:', error);
    return c.json({ error: 'Erro ao criar story' }, 500);
  }
});

// POST /api/stories/:id/view - Mark story as viewed
storyRoutes.post('/:id/view', requireAuth, async (c) => {
  const user = c.get('user')!;
  const storyId = c.req.param('id');

  const result = await storyService.markStoryAsViewed(storyId, user.id);
  return c.json(result);
});

// GET /api/stories/:id/viewers - Get story viewers (creator only)
storyRoutes.get('/:id/viewers', requireCreator, async (c) => {
  const creator = c.get('creator')!;
  const storyId = c.req.param('id');
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, 50);

  try {
    const result = await storyService.getStoryViewers(storyId, creator.id, page, pageSize);
    return c.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return c.json({ error: 'Você não pode ver os viewers deste story' }, 403);
    }
    throw error;
  }
});

// DELETE /api/stories/:id - Delete a story (creator only)
storyRoutes.delete('/:id', requireCreator, async (c) => {
  const creator = c.get('creator')!;
  const storyId = c.req.param('id');

  try {
    const result = await storyService.deleteStory(storyId, creator.id);
    return c.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Story not found') {
        return c.json({ error: 'Story não encontrado' }, 404);
      }
      if (error.message === 'Unauthorized') {
        return c.json({ error: 'Você não pode deletar este story' }, 403);
      }
    }
    throw error;
  }
});

export { storyRoutes };
