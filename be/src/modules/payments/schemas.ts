import { z } from 'zod';
import { LIMITS } from '@/config/constants';

// Validação de CPF/CNPJ (simplificada - apenas formato)
const cpfCnpjSchema = z.string().regex(
  /^(\d{11}|\d{14}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/,
  'CPF ou CNPJ inválido'
).transform(v => v.replace(/\D/g, '')); // Remove formatação

export const createSubscriptionPaymentSchema = z.object({
  creatorId: z.string().uuid(),
  duration: z.enum(['1', '3', '6', '12']).default('1'), // meses
  cpfCnpj: cpfCnpjSchema.optional(), // opcional para quem paga
});

export const createPPVPaymentSchema = z.object({
  contentId: z.string().uuid(),
  cpfCnpj: cpfCnpjSchema.optional(),
});

export const createTipPaymentSchema = z.object({
  creatorId: z.string().uuid(),
  amount: z.number().min(LIMITS.MIN_TIP_AMOUNT, `Gorjeta mínima é R$ ${(LIMITS.MIN_TIP_AMOUNT / 100).toFixed(2)}`),
  message: z.string().max(200).optional(),
  cpfCnpj: cpfCnpjSchema.optional(),
});

export const createProPlanPaymentSchema = z.object({
  cpfCnpj: cpfCnpjSchema.optional(),
});

export const listPaymentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  type: z.enum(['subscription', 'ppv', 'tip', 'pro_plan', 'all']).default('all'),
  status: z.enum(['pending', 'confirmed', 'failed', 'refunded', 'expired', 'all']).default('all'),
});

export type CreateSubscriptionPaymentInput = z.infer<typeof createSubscriptionPaymentSchema>;
export type CreatePPVPaymentInput = z.infer<typeof createPPVPaymentSchema>;
export type CreateTipPaymentInput = z.infer<typeof createTipPaymentSchema>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;
