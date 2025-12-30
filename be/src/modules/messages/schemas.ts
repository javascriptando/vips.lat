import { z } from 'zod';

export const sendMessageSchema = z.object({
  creatorId: z.string().uuid(),
  text: z.string().min(1).max(5000).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video']).optional(),
}).refine(data => data.text || data.mediaUrl, {
  message: 'Mensagem deve conter texto ou mídia',
});

export const listMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const markAsReadSchema = z.object({
  conversationId: z.string().uuid(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
