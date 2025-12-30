import { Hono } from 'hono';
import type { AppVariables } from '@/types';
import { requireAuth } from '@/middlewares/auth';
import * as notificationService from './service';

const notificationRoutes = new Hono<{ Variables: AppVariables }>();

// GET /api/notifications - Listar notificações do usuário
notificationRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, 50);

  const result = await notificationService.getNotifications(user.id, page, pageSize);
  return c.json(result);
});

// GET /api/notifications/unread-count - Contar não lidas
notificationRoutes.get('/unread-count', requireAuth, async (c) => {
  const user = c.get('user')!;
  const count = await notificationService.getUnreadCount(user.id);
  return c.json({ count });
});

// POST /api/notifications/:id/read - Marcar como lida
notificationRoutes.post('/:id/read', requireAuth, async (c) => {
  const user = c.get('user')!;
  const notificationId = c.req.param('id');

  const updated = await notificationService.markAsRead(notificationId, user.id);
  if (!updated) return c.json({ error: 'Notificação não encontrada' }, 404);

  return c.json({ message: 'Marcada como lida' });
});

// POST /api/notifications/read-all - Marcar todas como lidas
notificationRoutes.post('/read-all', requireAuth, async (c) => {
  const user = c.get('user')!;
  await notificationService.markAllAsRead(user.id);
  return c.json({ message: 'Todas marcadas como lidas' });
});

// DELETE /api/notifications/:id - Deletar notificação
notificationRoutes.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const notificationId = c.req.param('id');

  await notificationService.deleteNotification(notificationId, user.id);
  return c.json({ message: 'Notificação removida' });
});

export { notificationRoutes };
