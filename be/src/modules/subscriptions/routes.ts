import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import { listSubscriptionsSchema } from './schemas';
import * as subscriptionService from './service';
import * as creatorService from '@/modules/creators/service';

const subscriptionRoutes = new Hono<{ Variables: AppVariables }>();

// GET /api/subscriptions/plans/:creatorId - Obter planos de assinatura
subscriptionRoutes.get('/plans/:creatorId', async (c) => {
  const creatorId = c.req.param('creatorId');

  const creator = await creatorService.getCreatorById(creatorId);
  if (!creator) return c.json({ error: 'Criador não encontrado' }, 404);

  const plans = subscriptionService.getSubscriptionPlans(creator.subscriptionPrice);

  return c.json({
    creatorId,
    monthlyPrice: creator.subscriptionPrice,
    plans,
  });
});

// GET /api/subscriptions - Minhas assinaturas
subscriptionRoutes.get('/', requireAuth, zValidator('query', listSubscriptionsSchema), async (c) => {
  const user = c.get('user')!;
  const input = c.req.valid('query');

  const result = await subscriptionService.listUserSubscriptions(user.id, input);
  return c.json(result);
});

// GET /api/subscriptions/check/:creatorId - Verificar se assina
subscriptionRoutes.get('/check/:creatorId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const creatorId = c.req.param('creatorId');

  const subscription = await subscriptionService.getActiveSubscription(user.id, creatorId);

  return c.json({
    isSubscribed: !!subscription,
    subscription: subscription || null,
  });
});

// GET /api/subscriptions/:id
subscriptionRoutes.get('/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const subscriptionId = c.req.param('id');

  const subscription = await subscriptionService.getSubscriptionById(subscriptionId, user.id);
  if (!subscription) return c.json({ error: 'Assinatura não encontrada' }, 404);

  return c.json({ subscription });
});

// DELETE /api/subscriptions/:id - Cancelar assinatura
subscriptionRoutes.delete('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user')!;
    const subscriptionId = c.req.param('id');

    const subscription = await subscriptionService.cancelSubscription(subscriptionId, user.id);

    return c.json({
      message: 'Assinatura cancelada. Você terá acesso até o fim do período.',
      subscription,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// GET /api/subscriptions/subscribers - Meus assinantes (para criadores)
subscriptionRoutes.get('/me/subscribers', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  const result = await subscriptionService.listCreatorSubscribers(creator.id, page, pageSize);
  return c.json(result);
});

export { subscriptionRoutes };
