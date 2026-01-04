import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth, requireAdmin } from '@/middlewares/auth';
import {
  suspendUserSchema,
  unsuspendUserSchema,
  blockPayoutsSchema,
  listUsersSchema,
  listCreatorsSchema,
  listAuditLogsSchema,
  listFraudFlagsSchema,
  resolveFraudFlagSchema,
} from './schemas';
import * as adminService from './service';

const adminRoutes = new Hono<{ Variables: AppVariables }>();

// All routes require admin
adminRoutes.use('*', requireAuth, requireAdmin);

// ==================== DASHBOARD ====================

// GET /api/admin/stats - Dashboard stats
adminRoutes.get('/stats', async (c) => {
  const stats = await adminService.getDashboardStats();
  return c.json(stats);
});

// ==================== USER MANAGEMENT ====================

// GET /api/admin/users - List users
adminRoutes.get('/users', zValidator('query', listUsersSchema), async (c) => {
  const input = c.req.valid('query');
  const result = await adminService.getUsers(input);
  return c.json(result);
});

// GET /api/admin/users/:id - Get user details
adminRoutes.get('/users/:id', async (c) => {
  const userId = c.req.param('id');
  const result = await adminService.getUserById(userId);

  if (!result) {
    return c.json({ error: 'Usuário não encontrado' }, 404);
  }

  return c.json(result);
});

// POST /api/admin/users/:id/suspend - Suspend user
adminRoutes.post('/users/:id/suspend', zValidator('json', suspendUserSchema), async (c) => {
  try {
    const admin = c.get('user')!;
    const userId = c.req.param('id');
    const input = c.req.valid('json');

    await adminService.suspendUser(
      userId,
      admin.id,
      input,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({ message: 'Usuário suspenso com sucesso' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/admin/users/:id/unsuspend - Unsuspend user
adminRoutes.post('/users/:id/unsuspend', zValidator('json', unsuspendUserSchema), async (c) => {
  try {
    const admin = c.get('user')!;
    const userId = c.req.param('id');
    const input = c.req.valid('json');

    await adminService.unsuspendUser(
      userId,
      admin.id,
      input,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({ message: 'Suspensão removida com sucesso' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// ==================== CREATOR MANAGEMENT ====================

// GET /api/admin/creators - List creators
adminRoutes.get('/creators', zValidator('query', listCreatorsSchema), async (c) => {
  const input = c.req.valid('query');
  const result = await adminService.getCreators(input);
  return c.json(result);
});

// GET /api/admin/creators/:id - Get creator details
adminRoutes.get('/creators/:id', async (c) => {
  const creatorId = c.req.param('id');
  const result = await adminService.getCreatorById(creatorId);

  if (!result) {
    return c.json({ error: 'Criador não encontrado' }, 404);
  }

  return c.json(result);
});

// POST /api/admin/creators/:id/block-payouts - Block payouts
adminRoutes.post('/creators/:id/block-payouts', zValidator('json', blockPayoutsSchema), async (c) => {
  try {
    const admin = c.get('user')!;
    const creatorId = c.req.param('id');
    const input = c.req.valid('json');

    await adminService.blockCreatorPayouts(
      creatorId,
      admin.id,
      input,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({ message: 'Saques bloqueados com sucesso' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/admin/creators/:id/unblock-payouts - Unblock payouts
adminRoutes.post('/creators/:id/unblock-payouts', async (c) => {
  try {
    const admin = c.get('user')!;
    const creatorId = c.req.param('id');

    await adminService.unblockCreatorPayouts(
      creatorId,
      admin.id,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({ message: 'Saques desbloqueados com sucesso' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// ==================== CONTENT MANAGEMENT ====================

// DELETE /api/admin/content/:id - Remove content
adminRoutes.delete('/content/:id', async (c) => {
  try {
    const admin = c.get('user')!;
    const contentId = c.req.param('id');
    const { reason } = await c.req.json<{ reason: string }>();

    if (!reason || reason.length < 5) {
      return c.json({ error: 'Motivo é obrigatório (mínimo 5 caracteres)' }, 400);
    }

    await adminService.removeContent(
      contentId,
      admin.id,
      reason,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({ message: 'Conteúdo removido com sucesso' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/admin/content/:id/restore - Restore content
adminRoutes.post('/content/:id/restore', async (c) => {
  try {
    const admin = c.get('user')!;
    const contentId = c.req.param('id');

    await adminService.restoreContent(
      contentId,
      admin.id,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({ message: 'Conteúdo restaurado com sucesso' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// ==================== FRAUD FLAGS ====================

// GET /api/admin/fraud-flags - List fraud flags
adminRoutes.get('/fraud-flags', zValidator('query', listFraudFlagsSchema), async (c) => {
  const input = c.req.valid('query');
  const result = await adminService.getFraudFlags(input);
  return c.json(result);
});

// POST /api/admin/fraud-flags/:id/resolve - Resolve fraud flag
adminRoutes.post('/fraud-flags/:id/resolve', zValidator('json', resolveFraudFlagSchema), async (c) => {
  try {
    const admin = c.get('user')!;
    const flagId = c.req.param('id');
    const input = c.req.valid('json');

    await adminService.resolveFraudFlag(
      flagId,
      admin.id,
      input,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({ message: 'Flag resolvida com sucesso' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// ==================== AUDIT LOGS ====================

// GET /api/admin/audit-logs - List audit logs
adminRoutes.get('/audit-logs', zValidator('query', listAuditLogsSchema), async (c) => {
  const input = c.req.valid('query');
  const result = await adminService.getAuditLogs(input);
  return c.json(result);
});

export { adminRoutes };
