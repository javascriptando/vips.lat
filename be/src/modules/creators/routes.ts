import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import { uploadRateLimit } from '@/middlewares/rateLimit';
import { becomeCreatorSchema, updateCreatorSchema, setPixKeySchema, listCreatorsSchema } from './schemas';
import * as creatorService from './service';
import * as analyticsService from '@/modules/analytics/service';

const creatorRoutes = new Hono<{ Variables: AppVariables }>();

// POST /api/creators - Tornar-se criador
creatorRoutes.post('/', requireAuth, zValidator('json', becomeCreatorSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const input = c.req.valid('json');
    const creator = await creatorService.becomeCreator(user.id, input);
    return c.json({ message: 'Parabéns! Você agora é um criador.', creator }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro ao criar perfil' }, 400);
  }
});

// GET /api/creators - Listar criadores
creatorRoutes.get('/', zValidator('query', listCreatorsSchema), async (c) => {
  const input = c.req.valid('query');
  const result = await creatorService.listCreators(input);
  return c.json(result);
});

// GET /api/creators/featured - Criadores em destaque
creatorRoutes.get('/featured', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const user = c.get('user');
  const featured = await creatorService.getFeaturedCreators(Math.min(limit, 50), user?.id);
  return c.json({ creators: featured });
});

// GET /api/creators/recent - Criadores recentes
creatorRoutes.get('/recent', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const user = c.get('user');
  const recent = await creatorService.getRecentCreators(Math.min(limit, 50), user?.id);
  return c.json({ creators: recent });
});

// GET /api/creators/me
creatorRoutes.get('/me', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);
  return c.json({ creator });
});

// PUT /api/creators/me
creatorRoutes.put('/me', requireAuth, requireCreator, zValidator('json', updateCreatorSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const input = c.req.valid('json');
    const creator = await creatorService.getCreatorByUserId(user.id);
    if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);
    const updated = await creatorService.updateCreator(creator.id, input);
    return c.json({ creator: updated });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/creators/me/cover
creatorRoutes.post('/me/cover', requireAuth, requireCreator, uploadRateLimit, async (c) => {
  try {
    const user = c.get('user')!;
    const body = await c.req.parseBody();
    const file = body['file'] as File;
    if (!file) return c.json({ error: 'Arquivo não fornecido' }, 400);
    const creator = await creatorService.getCreatorByUserId(user.id);
    if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);
    const updated = await creatorService.updateCover(creator.id, file);
    return c.json({ message: 'Cover atualizada!', coverUrl: updated.coverUrl });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/creators/me/pix-key
creatorRoutes.post('/me/pix-key', requireAuth, requireCreator, zValidator('json', setPixKeySchema), async (c) => {
  try {
    const user = c.get('user')!;
    const { pixKey } = c.req.valid('json');
    const creator = await creatorService.getCreatorByUserId(user.id);
    if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);
    const updated = await creatorService.setPixKey(creator.id, pixKey);
    return c.json({ message: 'Chave PIX configurada!', pixKey: updated.asaasPixKey, pixKeyType: updated.asaasPixKeyType });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// GET /api/creators/me/stats
creatorRoutes.get('/me/stats', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);
  const stats = await creatorService.getCreatorStats(creator.id);
  return c.json({ stats });
});

// GET /api/creators/me/balance
creatorRoutes.get('/me/balance', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);
  const balance = await creatorService.getCreatorBalance(creator.id);
  return c.json(balance);
});

// GET /api/creators/me/subscribers - Lista de assinantes do criador
creatorRoutes.get('/me/subscribers', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const result = await creatorService.getCreatorSubscribers(creator.id, page, pageSize);
  return c.json(result);
});

// GET /api/creators/:username
creatorRoutes.get('/:username', async (c) => {
  const username = c.req.param('username');
  const user = c.get('user');
  const creator = await creatorService.getCreatorByUsername(username);
  if (!creator) return c.json({ error: 'Criador não encontrado' }, 404);

  // Track profile view
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const userAgent = c.req.header('user-agent') || '';
  const referer = c.req.header('referer') || '';
  const fingerprint = user?.id ? undefined : analyticsService.generateFingerprint(ip, userAgent);

  // Não trackear se é o próprio criador vendo seu perfil
  if (!user || creator.userId !== user.id) {
    await analyticsService.trackProfileView(
      creator.id,
      user?.id,
      fingerprint,
      { userAgent, referer }
    );
  }

  return c.json({
    creator: {
      id: creator.id,
      displayName: creator.displayName,
      bio: creator.bio,
      coverUrl: creator.coverUrl,
      subscriptionPrice: creator.subscriptionPrice,
      subscriberCount: creator.subscriberCount,
      postCount: creator.postCount,
      isPro: creator.isPro,
      verified: creator.verified,
      username: creator.username,
      avatarUrl: creator.avatarUrl,
      createdAt: creator.createdAt,
    },
  });
});

export { creatorRoutes };
