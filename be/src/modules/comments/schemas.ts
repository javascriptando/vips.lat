import { z } from 'zod';

export const createCommentSchema = z.object({
  text: z.string().min(1, 'Comentário não pode ser vazio').max(1000, 'Comentário muito longo'),
  parentId: z.string().uuid().optional(),
});

export const updateCommentSchema = z.object({
  text: z.string().min(1).max(1000),
});

export const listCommentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ListCommentsInput = z.infer<typeof listCommentsSchema>;
