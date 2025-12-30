import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import { requestPayoutSchema, listPayoutsSchema } from './schemas';
import * as payoutService from './service';
import * as creatorService from '@/modules/creators/service';

const payoutRoutes = new Hono<{ Variables: AppVariables }>();

// POST /api/payouts - Solicitar saque
payoutRoutes.post('/', requireAuth, requireCreator, zValidator('json', requestPayoutSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const { amount } = c.req.valid('json');

    const creator = await creatorService.getCreatorByUserId(user.id);
    if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

    const payout = await payoutService.requestPayout(creator.id, amount);

    return c.json({
      message: 'Saque solicitado com sucesso!',
      payout,
    }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// GET /api/payouts - Listar saques
payoutRoutes.get('/', requireAuth, requireCreator, zValidator('query', listPayoutsSchema), async (c) => {
  const user = c.get('user')!;
  const input = c.req.valid('query');

  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  const result = await payoutService.listCreatorPayouts(creator.id, input);
  return c.json(result);
});

// GET /api/payouts/balance - Saldo disponível
payoutRoutes.get('/balance', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;

  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  const balance = await creatorService.getCreatorBalance(creator.id);

  return c.json({ balance });
});

// GET /api/payouts/:id
payoutRoutes.get('/:id', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const payoutId = c.req.param('id');

  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  const payout = await payoutService.getPayoutById(payoutId);

  if (!payout || payout.creatorId !== creator.id) {
    return c.json({ error: 'Saque não encontrado' }, 404);
  }

  return c.json({ payout });
});

export { payoutRoutes };
