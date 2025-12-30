import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import { paymentRateLimit } from '@/middlewares/rateLimit';
import {
  createSubscriptionPaymentSchema,
  createPPVPaymentSchema,
  createTipPaymentSchema,
  createProPlanPaymentSchema,
  listPaymentsSchema,
} from './schemas';
import * as paymentService from './service';
import * as creatorService from '@/modules/creators/service';

const paymentRoutes = new Hono<{ Variables: AppVariables }>();

// POST /api/payments/subscription
paymentRoutes.post('/subscription', requireAuth, paymentRateLimit, zValidator('json', createSubscriptionPaymentSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const { creatorId, duration, cpfCnpj } = c.req.valid('json');

    const result = await paymentService.createSubscriptionPayment(user.id, creatorId, duration, cpfCnpj);

    return c.json({
      message: 'Pagamento criado! Escaneie o QR Code.',
      ...result,
    }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/payments/ppv
paymentRoutes.post('/ppv', requireAuth, paymentRateLimit, zValidator('json', createPPVPaymentSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const { contentId, cpfCnpj } = c.req.valid('json');

    const result = await paymentService.createPPVPayment(user.id, contentId, cpfCnpj);

    return c.json({
      message: 'Pagamento criado! Escaneie o QR Code.',
      ...result,
    }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/payments/tip
paymentRoutes.post('/tip', requireAuth, paymentRateLimit, zValidator('json', createTipPaymentSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const { creatorId, amount, message, cpfCnpj } = c.req.valid('json');

    const result = await paymentService.createTipPayment(user.id, creatorId, amount, message, cpfCnpj);

    return c.json({
      message: 'Gorjeta criada! Escaneie o QR Code.',
      ...result,
    }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/payments/pro
paymentRoutes.post('/pro', requireAuth, requireCreator, paymentRateLimit, zValidator('json', createProPlanPaymentSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const { cpfCnpj } = c.req.valid('json');

    const result = await paymentService.createProPlanPayment(user.id, cpfCnpj);

    return c.json({
      message: 'Pagamento PRO criado! Escaneie o QR Code.',
      ...result,
    }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// GET /api/payments
paymentRoutes.get('/', requireAuth, zValidator('query', listPaymentsSchema), async (c) => {
  const user = c.get('user')!;
  const input = c.req.valid('query');

  const result = await paymentService.listUserPayments(user.id, input);
  return c.json(result);
});

// GET /api/payments/:id
paymentRoutes.get('/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const paymentId = c.req.param('id');

  const payment = await paymentService.getPaymentById(paymentId);

  if (!payment || payment.payerId !== user.id) {
    return c.json({ error: 'Pagamento não encontrado' }, 404);
  }

  return c.json({ payment });
});

// GET /api/payments/:id/status
paymentRoutes.get('/:id/status', requireAuth, async (c) => {
  const user = c.get('user')!;
  const paymentId = c.req.param('id');

  const payment = await paymentService.getPaymentById(paymentId);

  if (!payment || payment.payerId !== user.id) {
    return c.json({ error: 'Pagamento não encontrado' }, 404);
  }

  return c.json({
    status: payment.status,
    paidAt: payment.paidAt,
  });
});

// GET /api/payments/earnings - Ganhos do criador
paymentRoutes.get('/me/earnings', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const creator = await creatorService.getCreatorByUserId(user.id);
  if (!creator) return c.json({ error: 'Perfil não encontrado' }, 404);

  const result = await paymentService.listCreatorEarnings(creator.id, page, pageSize);
  return c.json(result);
});

export { paymentRoutes };
