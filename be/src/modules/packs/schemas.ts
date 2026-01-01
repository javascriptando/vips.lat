import { z } from 'zod';

export const createPackSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().int().min(100), // mínimo R$ 1,00
  visibility: z.enum(['public', 'private']).default('public'),
  media: z.array(z.object({
    path: z.string(),
    url: z.string().url(),
    type: z.enum(['image', 'video']),
    size: z.number(),
    mimeType: z.string(),
    thumbnailUrl: z.string().optional(),
  })).min(1),
  coverUrl: z.string().url().optional(),
});

export const updatePackSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.number().int().min(100).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  isActive: z.boolean().optional(),
});

export type CreatePackInput = z.infer<typeof createPackSchema>;
export type UpdatePackInput = z.infer<typeof updatePackSchema>;
