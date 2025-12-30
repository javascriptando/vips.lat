import { z } from 'zod';

export const requestPayoutSchema = z.object({
  amount: z.number().optional(), // Se não informado, saca tudo disponível
});

export const listPayoutsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'all']).default('all'),
});

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;
export type ListPayoutsInput = z.infer<typeof listPayoutsSchema>;
