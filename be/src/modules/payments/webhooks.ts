import { Hono } from 'hono';
import { env } from '@/config/env';
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
  | 'PAYMENT_AWAITING_RISK_ANALYSIS';

interface AsaasWebhookPayload {
  event: AsaasEvent;
  payment: {
    id: string;
    externalReference: string;
    value: number;
    netValue: number;
    status: string;
    billingType: string;
    confirmedDate?: string;
    paymentDate?: string;
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
    const { event, payment: asaasPayment } = payload;

    console.log(`[Webhook] Received: ${event} for payment ${asaasPayment.externalReference}`);

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        console.log(`[Webhook] Confirming payment ${asaasPayment.externalReference}`);
        await paymentService.confirmPayment(asaasPayment.externalReference);
        break;

      case 'PAYMENT_REFUNDED':
        console.log(`[Webhook] Refunding payment ${asaasPayment.externalReference}`);
        try {
          await paymentService.refundPayment(asaasPayment.externalReference);
        } catch (err) {
          console.error(`[Webhook] Refund error: ${err}`);
        }
        break;

      case 'PAYMENT_OVERDUE':
        console.log(`[Webhook] Marking payment expired ${asaasPayment.externalReference}`);
        await paymentService.markPaymentExpired(asaasPayment.externalReference);
        break;

      case 'PAYMENT_DELETED':
        console.log(`[Webhook] Marking payment failed ${asaasPayment.externalReference}`);
        await paymentService.markPaymentFailed(asaasPayment.externalReference);
        break;

      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
        // Eventos informativos - apenas log
        console.log(`[Webhook] Info event: ${event} for ${asaasPayment.externalReference}`);
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

export { webhookRoutes };
