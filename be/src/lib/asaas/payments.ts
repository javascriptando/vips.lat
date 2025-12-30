import { asaas, type AsaasPayment, type AsaasPixQrCode } from './client';
import { tomorrowDate } from '@/lib/utils';

interface CreatePixPaymentInput {
  customerId: string;
  value: number; // em reais
  description: string;
  externalReference: string;
  dueDate?: string;
}

export async function createPixPayment(input: CreatePixPaymentInput): Promise<{
  payment: AsaasPayment;
  qrCode: AsaasPixQrCode;
}> {
  // Criar cobrança PIX
  const payment = await asaas.post<AsaasPayment>('/payments', {
    customer: input.customerId,
    billingType: 'PIX',
    value: input.value,
    dueDate: input.dueDate || tomorrowDate(),
    description: input.description,
    externalReference: input.externalReference,
  });

  // Buscar QR Code
  const qrCode = await asaas.get<AsaasPixQrCode>(`/payments/${payment.id}/pixQrCode`);

  return { payment, qrCode };
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaas.get<AsaasPayment>(`/payments/${paymentId}`);
}

export async function getPaymentByExternalReference(externalReference: string): Promise<AsaasPayment | null> {
  const response = await asaas.get<{ data: AsaasPayment[] }>(
    `/payments?externalReference=${encodeURIComponent(externalReference)}`
  );
  return response.data[0] || null;
}

export async function cancelPayment(paymentId: string): Promise<AsaasPayment> {
  return asaas.delete<AsaasPayment>(`/payments/${paymentId}`);
}

export async function refundPayment(paymentId: string, value?: number): Promise<AsaasPayment> {
  return asaas.post<AsaasPayment>(`/payments/${paymentId}/refund`, value ? { value } : {});
}

export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaas.get<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}
