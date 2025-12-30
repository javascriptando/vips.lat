import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import { uploadRateLimit } from '@/middlewares/rateLimit';
import { createContentSchema, updateContentSchema, listContentSchema } from './schemas';
import * as contentService from './service';
import * as creatorService from '@/modules/creators/service';
import * as analyticsService from '@/modules/analytics/service';

const contentRoutes = new Hono<{ Variables: AppVariables }>();

// POST /api/content - Criar conteúdo
contentRoutes.post('/', requireAuth, requireCreator, uploadRateLimit, async (c) => {
  try {
    const user = c.get('user')!;
    const body = await c.req.parseBody();

    const input = createContentSchema.parse({
      type: body['type'],
      visibility: body['visibility'],
      text: body['text'],
      ppvPrice: body['ppvPrice'] ? Number(body['ppvPrice']) : undefined,
    });

    const creator = await creatorService.getCreatorByUserId(user.id);
    if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

    // Coletar arquivos
    const files: File[] = [];
    for (const key of Object.keys(body)) {
      if (key.startsWith('file') && body[key] instanceof File) {
        files.push(body[key] as File);
      }
    }

    const content = await contentService.createContent(creator.id, input, files);
    return c.json({ message: 'Conteúdo criado!', content }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// GET /api/content - Feed do usuário (requer auth)
contentRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const result = await contentService.getFeed(user.id, page, pageSize);
  return c.json(result);
});

// GET /api/content/explore - Feed de exploração público
contentRoutes.get('/explore', async (c) => {
  const user = c.get('user');
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, 50);
  const sortBy = (c.req.query('sortBy') as 'recent' | 'trending' | 'top') || 'recent';

  const result = await contentService.getExploreFeed(page, pageSize, user?.id, sortBy);
  return c.json(result);
});

// GET /api/content/trending - Conteúdo em alta
contentRoutes.get('/trending', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 20, 50);
  const trending = await contentService.getTrendingContent(limit);
  return c.json({ content: trending });
});

// GET /api/content/purchased - Conteúdo comprado pelo usuário
contentRoutes.get('/purchased', requireAuth, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const result = await contentService.getPurchasedContent(user.id, page, pageSize);
  return c.json(result);
});

// GET /api/content/:id
contentRoutes.get('/:id', async (c) => {
  const contentId = c.req.param('id');
  const user = c.get('user');

  const content = await contentService.getContentById(contentId, user?.id);
  if (!content) return c.json({ error: 'Conteúdo não encontrado' }, 404);

  // Track view com detalhes (após confirmar que conteúdo existe)
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const userAgent = c.req.header('user-agent') || '';
  const referer = c.req.header('referer') || '';
  const fingerprint = user?.id ? undefined : analyticsService.generateFingerprint(ip, userAgent);

  await analyticsService.trackContentView(
    contentId,
    content.creatorId,
    user?.id,
    fingerprint,
    { userAgent, referer }
  );

  return c.json({ content });
});

// PUT /api/content/:id
contentRoutes.put('/:id', requireAuth, requireCreator, zValidator('json', updateContentSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const contentId = c.req.param('id');
    const input = c.req.valid('json');

    const creator = await creatorService.getCreatorByUserId(user.id);
    if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

    const updated = await contentService.updateContent(contentId, creator.id, input);
    return c.json({ content: updated });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// DELETE /api/content/:id
contentRoutes.delete('/:id', requireAuth, requireCreator, async (c) => {
  try {
    const user = c.get('user')!;
    const contentId = c.req.param('id');

    const creator = await creatorService.getCreatorByUserId(user.id);
    if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

    await contentService.deleteContent(contentId, creator.id);
    return c.json({ message: 'Conteúdo removido!' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/content/:id/like
contentRoutes.post('/:id/like', requireAuth, async (c) => {
  const user = c.get('user')!;
  const contentId = c.req.param('id');

  const result = await contentService.likeContent(contentId, user.id);
  return c.json(result);
});

// GET /api/content/creator/:creatorId
contentRoutes.get('/creator/:creatorId', zValidator('query', listContentSchema), async (c) => {
  const creatorId = c.req.param('creatorId');
  const input = c.req.valid('query');
  const user = c.get('user');

  const result = await contentService.listCreatorContent(creatorId, input, user?.id);
  return c.json(result);
});

export { contentRoutes };
