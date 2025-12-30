import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  creatorId: z.string().uuid('ID do criador inválido'),
});

export const listSubscriptionsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['active', 'cancelled', 'expired', 'pending', 'all']).default('all'),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type ListSubscriptionsInput = z.infer<typeof listSubscriptionsSchema>;
