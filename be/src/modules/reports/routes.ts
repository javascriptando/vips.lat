import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth, requireAdmin } from '@/middlewares/auth';
import { createReportSchema, reviewReportSchema, listReportsSchema } from './schemas';
import * as reportService from './service';

const reportRoutes = new Hono<{ Variables: AppVariables }>();

// POST /api/reports - Create a report (any authenticated user)
reportRoutes.post('/', requireAuth, zValidator('json', createReportSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const input = c.req.valid('json');

    const report = await reportService.createReport(user.id, input);

    return c.json({
      message: 'Denúncia enviada com sucesso. Nossa equipe irá analisar.',
      report: {
        id: report.id,
        status: report.status,
        createdAt: report.createdAt,
      },
    }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro ao enviar denúncia' }, 400);
  }
});

// ==================== ADMIN ROUTES ====================

// GET /api/reports/admin - List reports (admin)
reportRoutes.get('/admin', requireAuth, requireAdmin, zValidator('query', listReportsSchema), async (c) => {
  const input = c.req.valid('query');

  const result = await reportService.getReports(input);

  return c.json(result);
});

// GET /api/reports/admin/:id - Get report details (admin)
reportRoutes.get('/admin/:id', requireAuth, requireAdmin, async (c) => {
  const reportId = c.req.param('id');

  const report = await reportService.getReportById(reportId);

  if (!report) {
    return c.json({ error: 'Denúncia não encontrada' }, 404);
  }

  return c.json({ report });
});

// POST /api/reports/admin/:id/review - Review report (admin)
reportRoutes.post('/admin/:id/review', requireAuth, requireAdmin, zValidator('json', reviewReportSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const reportId = c.req.param('id');
    const input = c.req.valid('json');

    await reportService.reviewReport(
      reportId,
      user.id,
      input,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({
      message: input.action === 'dismissed'
        ? 'Denúncia arquivada'
        : 'Denúncia processada com sucesso',
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro ao processar denúncia' }, 400);
  }
});

export { reportRoutes };
