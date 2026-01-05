import { Hono } from 'hono';
import { env } from '@/config/env';
import { db } from '@/db';
import { payouts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as paymentService from './service';

const webhookRoutes = new Hono();

type AsaasEvent =
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_AWAITING_RISK_ANALYSIS'
  | 'TRANSFER_CREATED'
  | 'TRANSFER_PENDING'
  | 'TRANSFER_IN_BANK_PROCESSING'
  | 'TRANSFER_BLOCKED'
  | 'TRANSFER_DONE'
  | 'TRANSFER_FAILED'
  | 'TRANSFER_CANCELLED';

interface AsaasWebhookPayload {
  event: AsaasEvent;
  payment?: {
    id: string;
    externalReference: string;
    value: number;
    netValue: number;
    status: string;
    billingType: string;
    confirmedDate?: string;
    paymentDate?: string;
  };
  transfer?: {
    id: string;
    externalReference: string;
    value: number;
    status: string;
    effectiveDate?: string;
    failReason?: string;
  };
}

// POST /webhooks/asaas
webhookRoutes.post('/asaas', async (c) => {
  try {
    // Validar token do webhook (opcional mas recomendado)
    const token = c.req.header('asaas-access-token');
    if (env.ASAAS_WEBHOOK_TOKEN && token !== env.ASAAS_WEBHOOK_TOKEN) {
      console.warn('[Webhook] Invalid webhook token');
      return c.json({ error: 'Invalid token' }, 401);
    }

    const payload = await c.req.json<AsaasWebhookPayload>();
    const { event, payment: asaasPayment, transfer } = payload;

    const ref = asaasPayment?.externalReference || transfer?.externalReference || 'unknown';
    console.log(`[Webhook] Received: ${event} for ref ${ref}`);

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        if (asaasPayment?.externalReference) {
          console.log(`[Webhook] Confirming payment ${asaasPayment.externalReference}`);
          await paymentService.confirmPayment(asaasPayment.externalReference);
        }
        break;

      case 'PAYMENT_REFUNDED':
        if (asaasPayment?.externalReference) {
          console.log(`[Webhook] Refunding payment ${asaasPayment.externalReference}`);
          try {
            await paymentService.refundPayment(asaasPayment.externalReference);
          } catch (err) {
            console.error(`[Webhook] Refund error: ${err}`);
          }
        }
        break;

      case 'PAYMENT_OVERDUE':
        if (asaasPayment?.externalReference) {
          console.log(`[Webhook] Marking payment expired ${asaasPayment.externalReference}`);
          await paymentService.markPaymentExpired(asaasPayment.externalReference);
        }
        break;

      case 'PAYMENT_DELETED':
        if (asaasPayment?.externalReference) {
          console.log(`[Webhook] Marking payment failed ${asaasPayment.externalReference}`);
          await paymentService.markPaymentFailed(asaasPayment.externalReference);
        }
        break;

      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
        // Eventos informativos - apenas log
        console.log(`[Webhook] Info event: ${event} for ${asaasPayment?.externalReference}`);
        break;

      // Eventos de transferência (saques)
      case 'TRANSFER_DONE': {
        const transfer = payload.transfer;
        if (transfer?.externalReference) {
          console.log(`[Webhook] Transfer completed: ${transfer.externalReference}`);
          await db.update(payouts)
            .set({ status: 'completed', processedAt: new Date() })
            .where(eq(payouts.id, transfer.externalReference));
        }
        break;
      }

      case 'TRANSFER_FAILED':
      case 'TRANSFER_CANCELLED': {
        const transfer = payload.transfer;
        if (transfer?.externalReference) {
          console.log(`[Webhook] Transfer failed/cancelled: ${transfer.externalReference}`);
          await db.update(payouts)
            .set({
              status: 'failed',
              failedReason: transfer.failReason || event
            })
            .where(eq(payouts.id, transfer.externalReference));
        }
        break;
      }

      case 'TRANSFER_CREATED':
      case 'TRANSFER_PENDING':
      case 'TRANSFER_IN_BANK_PROCESSING':
      case 'TRANSFER_BLOCKED':
        console.log(`[Webhook] Transfer event: ${event} for ${payload.transfer?.externalReference}`);
        break;

      default:
        console.log(`[Webhook] Unknown event: ${event}`);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// POST /webhooks/asaas/transfer-validation - Validação automática de saques
webhookRoutes.post('/asaas/transfer-validation', async (c) => {
  try {
    // Validar token do webhook
    const token = c.req.header('asaas-access-token');
    if (env.ASAAS_WEBHOOK_TOKEN && token !== env.ASAAS_WEBHOOK_TOKEN) {
      console.warn('[Webhook] Invalid transfer validation token');
      return c.json({ status: 'REFUSED', refuseReason: 'Invalid token' }, 401);
    }

    const payload = await c.req.json();
    console.log('[Webhook] Transfer validation request:', JSON.stringify(payload));

    // Verificar se é uma transferência válida (externalReference deve ser um UUID de payout)
    const externalRef = payload.externalReference || payload.transfer?.externalReference;

    if (externalRef) {
      try {
        // Verificar se o payout existe no banco (UUID válido)
        const payout = await db.query.payouts.findFirst({
          where: eq(payouts.id, externalRef)
        });

        if (payout) {
          console.log(`[Webhook] Auto-approving transfer for payout ${externalRef}`);
          return c.json({ status: 'APPROVED' });
        }
      } catch (dbError) {
        // UUID inválido ou erro de banco - aprovar mesmo assim
        console.log(`[Webhook] DB error (probably invalid UUID), approving anyway: ${externalRef}`);
      }
    }

    // Aprovar todas as transferências por padrão
    console.log('[Webhook] Auto-approving transfer (default)');
    return c.json({ status: 'APPROVED' });
  } catch (error) {
    console.error('[Webhook] Transfer validation error:', error);
    // Em caso de erro, recusar para segurança
    return c.json({ status: 'REFUSED', refuseReason: 'Internal error' }, 500);
  }
});

export { webhookRoutes };
