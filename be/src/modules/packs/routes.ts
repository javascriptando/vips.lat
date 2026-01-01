import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import { createPackSchema, updatePackSchema } from './schemas';
import * as packsService from './service';

const packs = new Hono<{ Variables: AppVariables }>();

// Get my packs (creator)
packs.get('/me', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  try {
    const result = await packsService.getMyPacks(user.id, page, pageSize);
    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return c.json({ error: message }, 400);
  }
});

// Get all my packs for chat selector (creator)
packs.get('/me/all', requireAuth, requireCreator, async (c) => {
  const user = c.get('user')!;

  try {
    const packs = await packsService.getCreatorAllPacks(user.id);
    return c.json({ packs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return c.json({ error: message }, 400);
  }
});

// Create pack
packs.post('/', requireAuth, requireCreator, zValidator('json', createPackSchema), async (c) => {
  const user = c.get('user')!;
  const input = c.req.valid('json');

  try {
    const pack = await packsService.createPack(user.id, input);
    return c.json({ message: 'Pacote criado com sucesso', pack }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return c.json({ error: message }, 400);
  }
});

// Update pack
packs.put(
  '/:packId',
  requireAuth,
  requireCreator,
  zValidator('param', z.object({ packId: z.string().uuid() })),
  zValidator('json', updatePackSchema),
  async (c) => {
    const user = c.get('user')!;
    const { packId } = c.req.valid('param');
    const input = c.req.valid('json');

    try {
      const pack = await packsService.updatePack(user.id, packId, input);
      return c.json({ pack });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 400);
    }
  }
);

// Delete pack
packs.delete(
  '/:packId',
  requireAuth,
  requireCreator,
  zValidator('param', z.object({ packId: z.string().uuid() })),
  async (c) => {
    const user = c.get('user')!;
    const { packId } = c.req.valid('param');

    try {
      await packsService.deletePack(user.id, packId);
      return c.json({ message: 'Pacote excluído com sucesso' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 400);
    }
  }
);

// Get my purchased packs (MUST be before /:packId to avoid "purchased" being treated as a packId)
packs.get('/purchased', requireAuth, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  try {
    const result = await packsService.getUserPurchasedPacks(user.id, page, pageSize);
    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return c.json({ error: message }, 400);
  }
});

// Get public packs for a creator profile
packs.get(
  '/creator/:creatorId',
  zValidator('param', z.object({ creatorId: z.string().uuid() })),
  async (c) => {
    const { creatorId } = c.req.valid('param');
    const page = Number(c.req.query('page')) || 1;
    const pageSize = Number(c.req.query('pageSize')) || 20;

    try {
      const result = await packsService.getCreatorPublicPacks(creatorId, page, pageSize);
      return c.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 400);
    }
  }
);

// Get pack details (dynamic route - must be LAST)
packs.get(
  '/:packId',
  zValidator('param', z.object({ packId: z.string().uuid() })),
  async (c) => {
    const { packId } = c.req.valid('param');
    const user = c.get('user');

    try {
      const pack = await packsService.getPackForUser(packId, user?.id || null);
      return c.json({ pack });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 404);
    }
  }
);

export default packs;
