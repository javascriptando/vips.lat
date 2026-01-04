import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator, requireAdmin } from '@/middlewares/auth';
import { uploadRateLimit } from '@/middlewares/rateLimit';
import { submitKycSchema, reviewKycSchema, listKycSchema } from './schemas';
import * as kycService from './service';
import * as creatorService from '@/modules/creators/service';

const kycRoutes = new Hono<{ Variables: AppVariables }>();

// POST /api/kyc/submit - Submit KYC documents (creator)
kycRoutes.post('/submit', requireAuth, requireCreator, uploadRateLimit, async (c) => {
  try {
    const creator = c.get('creator')!;

    const formData = await c.req.formData();

    // Parse JSON data
    const dataJson = formData.get('data');
    if (!dataJson || typeof dataJson !== 'string') {
      return c.json({ error: 'Dados do formulário não encontrados' }, 400);
    }

    const parseResult = submitKycSchema.safeParse(JSON.parse(dataJson));
    if (!parseResult.success) {
      return c.json({ error: parseResult.error.errors[0].message }, 400);
    }

    const input = parseResult.data;

    // Get files
    const documentFront = formData.get('documentFront') as File | null;
    const documentBack = formData.get('documentBack') as File | null;
    const selfie = formData.get('selfie') as File | null;

    if (!documentFront) {
      return c.json({ error: 'Foto do documento (frente) é obrigatória' }, 400);
    }

    if (!selfie) {
      return c.json({ error: 'Selfie segurando o documento é obrigatória' }, 400);
    }

    if (input.documentType === 'rg' && !documentBack) {
      return c.json({ error: 'Foto do verso do RG é obrigatória' }, 400);
    }

    const kyc = await kycService.submitKyc(
      creator.id,
      input,
      {
        documentFront,
        documentBack: documentBack || undefined,
        selfie,
      },
      {
        ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
      }
    );

    return c.json({
      message: 'Documentos enviados com sucesso! Aguarde a análise.',
      kyc: {
        id: kyc.id,
        status: kyc.status,
        createdAt: kyc.createdAt,
      },
    }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro ao enviar documentos' }, 400);
  }
});

// GET /api/kyc/status - Get own KYC status (creator)
kycRoutes.get('/status', requireAuth, requireCreator, async (c) => {
  const creator = c.get('creator')!;

  const result = await kycService.getKycStatus(creator.id);

  return c.json(result);
});

// ==================== ADMIN ROUTES ====================

// GET /api/kyc/admin - List pending KYC verifications (admin)
kycRoutes.get('/admin', requireAuth, requireAdmin, zValidator('query', listKycSchema), async (c) => {
  const input = c.req.valid('query');

  const result = await kycService.getPendingKycVerifications(input);

  return c.json(result);
});

// GET /api/kyc/admin/:id - Get KYC details (admin)
kycRoutes.get('/admin/:id', requireAuth, requireAdmin, async (c) => {
  const kycId = c.req.param('id');

  const kyc = await kycService.getKycById(kycId);

  if (!kyc) {
    return c.json({ error: 'Verificação KYC não encontrada' }, 404);
  }

  return c.json({ kyc });
});

// POST /api/kyc/admin/:id/review - Review KYC (admin)
kycRoutes.post('/admin/:id/review', requireAuth, requireAdmin, zValidator('json', reviewKycSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const kycId = c.req.param('id');
    const input = c.req.valid('json');

    await kycService.reviewKyc(
      kycId,
      user.id,
      input,
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    );

    return c.json({
      message: input.status === 'approved'
        ? 'KYC aprovado com sucesso'
        : 'KYC rejeitado',
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro ao processar KYC' }, 400);
  }
});

export { kycRoutes };
