import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import { sendMessageSchema } from './schemas';
import * as messagesService from './service';
import * as creatorService from '@/modules/creators/service';

const messages = new Hono<{ Variables: AppVariables }>();

// Todas as rotas requerem autenticação
messages.use('/*', requireAuth);

// Listar conversas do usuário
messages.get('/conversations', async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const convos = await messagesService.listUserConversations(user.id, page, pageSize);
  return c.json({ conversations: convos });
});

// Listar conversas do criador
messages.get('/conversations/creator', requireCreator, async (c) => {
  const user = c.get('user')!;
  const creator = await creatorService.getCreatorByUserId(user.id);

  if (!creator) {
    return c.json({ error: 'Você não é um criador' }, 404);
  }

  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const convos = await messagesService.listCreatorConversations(creator.id, page, pageSize);
  return c.json({ conversations: convos });
});

// Listar mensagens de uma conversa
messages.get(
  '/conversations/:conversationId/messages',
  zValidator('param', z.object({ conversationId: z.string().uuid() })),
  zValidator('query', z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })),
  async (c) => {
    const user = c.get('user')!;
    const { conversationId } = c.req.valid('param');
    const { page, pageSize } = c.req.valid('query');

    try {
      const msgs = await messagesService.listMessages(user.id, { conversationId, page, pageSize });
      return c.json({ messages: msgs });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 403);
    }
  }
);

// Verificar se pode enviar mensagem para um criador
messages.get('/can-send/:creatorId', zValidator('param', z.object({ creatorId: z.string().uuid() })), async (c) => {
  const user = c.get('user')!;
  const { creatorId } = c.req.valid('param');

  const result = await messagesService.canSendMessage(user.id, creatorId);
  return c.json(result);
});

// Enviar mensagem para criador (como usuário)
messages.post('/send', zValidator('json', sendMessageSchema), async (c) => {
  const user = c.get('user')!;
  const input = c.req.valid('json');

  try {
    const message = await messagesService.sendMessage(user.id, input);
    return c.json({ message }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return c.json({ error: message }, 400);
  }
});

// Enviar mensagem para usuário (como criador)
messages.post(
  '/conversations/:conversationId/send',
  zValidator('param', z.object({ conversationId: z.string().uuid() })),
  zValidator('json', z.object({
    text: z.string().min(1).max(5000).optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(['image', 'video']).optional(),
  }).refine(data => data.text || data.mediaUrl, { message: 'Mensagem deve conter texto ou mídia' })),
  async (c) => {
    const user = c.get('user')!;
    const { conversationId } = c.req.valid('param');
    const { text, mediaUrl, mediaType } = c.req.valid('json');

    try {
      const msg = await messagesService.sendMessageAsCreator(user.id, conversationId, text, mediaUrl, mediaType);
      return c.json({ message: msg }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 400);
    }
  }
);

// Marcar conversa como lida
messages.post(
  '/conversations/:conversationId/read',
  zValidator('param', z.object({ conversationId: z.string().uuid() })),
  async (c) => {
    const user = c.get('user')!;
    const { conversationId } = c.req.valid('param');

    try {
      await messagesService.markConversationAsRead(user.id, conversationId);
      return c.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 400);
    }
  }
);

// Obter contagem de não lidas
messages.get('/unread-count', async (c) => {
  const user = c.get('user')!;
  const count = await messagesService.getUnreadCount(user.id);
  return c.json(count);
});

// Bloquear/desbloquear conversa (criador)
messages.post(
  '/conversations/:conversationId/toggle-block',
  zValidator('param', z.object({ conversationId: z.string().uuid() })),
  async (c) => {
    const user = c.get('user')!;
    const { conversationId } = c.req.valid('param');

    try {
      const conversation = await messagesService.toggleBlockConversation(user.id, conversationId);
      return c.json({ conversation });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 400);
    }
  }
);

export default messages;
