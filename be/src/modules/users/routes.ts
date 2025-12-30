import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth } from '@/middlewares/auth';
import { uploadRateLimit } from '@/middlewares/rateLimit';
import { updateProfileSchema } from './schemas';
import * as userService from './service';

const userRoutes = new Hono<{ Variables: AppVariables }>();

// GET /api/users/me
userRoutes.get('/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const fullUser = await userService.getUserById(user.id);

  if (!fullUser) {
    return c.json({ error: 'Usuário não encontrado' }, 404);
  }

  return c.json({ user: fullUser });
});

// PUT /api/users/me
userRoutes.put(
  '/me',
  requireAuth,
  zValidator('json', updateProfileSchema),
  async (c) => {
    try {
      const user = c.get('user')!;
      const input = c.req.valid('json');

      const updatedUser = await userService.updateProfile(user.id, input);

      return c.json({ user: updatedUser });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      return c.json({ error: message }, 400);
    }
  }
);

// POST /api/users/me/avatar
userRoutes.post('/me/avatar', requireAuth, uploadRateLimit, async (c) => {
  try {
    const user = c.get('user')!;
    const body = await c.req.parseBody();
    const file = body['file'] as File;

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'Arquivo não fornecido' }, 400);
    }

    const updatedUser = await userService.updateAvatar(user.id, file);

    return c.json({
      message: 'Avatar atualizado com sucesso!',
      avatarUrl: updatedUser.avatarUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar avatar';
    return c.json({ error: message }, 400);
  }
});

// DELETE /api/users/me/avatar
userRoutes.delete('/me/avatar', requireAuth, async (c) => {
  try {
    const user = c.get('user')!;
    await userService.deleteAvatar(user.id);

    return c.json({ message: 'Avatar removido com sucesso!' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao remover avatar';
    return c.json({ error: message }, 400);
  }
});

// POST /api/users/me/banner
userRoutes.post('/me/banner', requireAuth, uploadRateLimit, async (c) => {
  try {
    const user = c.get('user')!;
    const body = await c.req.parseBody();
    const file = body['file'] as File;

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'Arquivo não fornecido' }, 400);
    }

    const updatedUser = await userService.updateBanner(user.id, file);

    return c.json({
      message: 'Banner atualizado com sucesso!',
      bannerUrl: updatedUser.bannerUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar banner';
    return c.json({ error: message }, 400);
  }
});

// GET /api/users/check-username/:username
userRoutes.get('/check-username/:username', async (c) => {
  const username = c.req.param('username');
  const user = c.get('user');

  const available = await userService.checkUsernameAvailability(
    username,
    user?.id
  );

  return c.json({ available });
});

// GET /api/users/:username
userRoutes.get('/:username', async (c) => {
  const username = c.req.param('username');
  const user = await userService.getUserByUsername(username);

  if (!user) {
    return c.json({ error: 'Usuário não encontrado' }, 404);
  }

  return c.json({ user });
});

export { userRoutes };
