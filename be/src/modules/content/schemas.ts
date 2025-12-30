import { z } from 'zod';
import { LIMITS } from '@/config/constants';

export const createContentSchema = z.object({
  type: z.enum(['post', 'image', 'video']),
  visibility: z.enum(['public', 'subscribers', 'ppv']).default('subscribers'),
  text: z.string().max(LIMITS.MAX_POST_LENGTH).optional(),
  ppvPrice: z.number().min(LIMITS.MIN_PPV_PRICE).max(LIMITS.MAX_PPV_PRICE).optional(),
});

export const updateContentSchema = z.object({
  text: z.string().max(LIMITS.MAX_POST_LENGTH).optional(),
  visibility: z.enum(['public', 'subscribers', 'ppv']).optional(),
  ppvPrice: z.number().min(LIMITS.MIN_PPV_PRICE).max(LIMITS.MAX_PPV_PRICE).optional(),
});

export const listContentSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  visibility: z.enum(['public', 'subscribers', 'ppv', 'all']).default('all'),
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type ListContentInput = z.infer<typeof listContentSchema>;
