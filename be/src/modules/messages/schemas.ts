import { z } from 'zod';

export const sendMessageSchema = z.object({
  creatorId: z.string().uuid(),
  text: z.string().min(1).max(5000).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video']).optional(),
}).refine(data => data.text || data.mediaUrl, {
  message: 'Mensagem deve conter texto ou mídia',
});

// Creator sending message with optional pack or PPV media
export const creatorSendMessageSchema = z.object({
  text: z.string().min(1).max(5000).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video']).optional(),
  thumbnailUrl: z.string().url().optional(),
  ppvPrice: z.number().int().min(100).optional(), // PPV price in cents
  packId: z.string().uuid().optional(), // Attach existing pack
}).refine(data => data.text || data.mediaUrl || data.packId, {
  message: 'Mensagem deve conter texto, mídia ou pacote',
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
export type CreatorSendMessageInput = z.infer<typeof creatorSendMessageSchema>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
