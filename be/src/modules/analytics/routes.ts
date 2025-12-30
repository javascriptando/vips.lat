import { Hono } from 'hono';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import * as analyticsService from './service';
import * as creatorService from '@/modules/creators/service';
import { db } from '@/db';
import { contents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const analyticsRoutes = new Hono<{ Variables: AppVariables }>();

// GET /api/analytics - Analytics básico (todos os criadores)
analyticsRoutes.get('/', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  const analytics = await analyticsService.getBasicAnalytics(creator.id);
  return c.json({ analytics, isPro: creator.isPro });
});

// GET /api/analytics/pro - Analytics avançado (apenas PRO)
analyticsRoutes.get('/pro', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  if (!creator.isPro) {
    return c.json({ error: 'Recurso disponível apenas para criadores PRO', requiresPro: true }, 403);
  }

  const days = Number(c.req.query('days')) || 30;
  const analytics = await analyticsService.getProAnalytics(creator.id, Math.min(days, 90));
  return c.json({ analytics, isPro: true });
});

// GET /api/analytics/content/:contentId - Analytics de um conteúdo específico
analyticsRoutes.get('/content/:contentId', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const contentId = c.req.param('contentId');
  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  // Verificar se o conteúdo pertence ao criador
  const content = await db.query.contents.findFirst({
    where: and(eq(contents.id, contentId), eq(contents.creatorId, creator.id)),
  });

  if (!content) {
    return c.json({ error: 'Conteúdo não encontrado' }, 404);
  }

  // TODO: Implementar analytics detalhado por conteúdo
  return c.json({
    content: {
      id: content.id,
      viewCount: content.viewCount,
      likeCount: content.likeCount,
    },
  });
});

export { analyticsRoutes };
