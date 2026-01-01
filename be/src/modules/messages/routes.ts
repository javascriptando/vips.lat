import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppVariables } from '@/types';
import { requireAuth, requireCreator } from '@/middlewares/auth';
import { sendMessageSchema, creatorSendMessageSchema } from './schemas';
import * as messagesService from './service';
import * as creatorService from '@/modules/creators/service';
import { uploadFile } from '@/lib/storage';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

// Obter ou criar conversa com um criador
messages.post(
  '/conversations/get-or-create/:creatorId',
  zValidator('param', z.object({ creatorId: z.string().uuid() })),
  async (c) => {
    const user = c.get('user')!;
    const { creatorId } = c.req.valid('param');

    try {
      const conversation = await messagesService.getOrCreateConversation(user.id, creatorId);

      // Get creator info for the response
      const creator = await creatorService.getCreatorById(creatorId);
      const creatorUser = creator ? await db.select().from(users).where(eq(users.id, creator.userId)).then(rows => rows[0]) : null;

      return c.json({
        id: conversation.id,
        creatorId,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        creatorDisplayName: creator?.displayName,
        creatorUsername: creatorUser?.username,
        creatorAvatarUrl: creatorUser?.avatarUrl,
        creatorVerified: creator?.verified,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return c.json({ error: message }, 400);
    }
  }
);

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
  zValidator('json', creatorSendMessageSchema),
  async (c) => {
    const user = c.get('user')!;
    const { conversationId } = c.req.valid('param');
    const input = c.req.valid('json');

    try {
      const msg = await messagesService.sendMessageAsCreator(user.id, conversationId, input);
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

// Get exclusive content (purchased PPV messages - collector items)
messages.get('/exclusive', async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  try {
    const exclusiveContent = await messagesService.getExclusiveContent(user.id, page, pageSize);
    return c.json(exclusiveContent);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return c.json({ error: message }, 400);
  }
});

// Upload media for message (creator only)
messages.post('/upload', requireCreator, async (c) => {
  const creator = c.get('creator')!;

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return c.json({ error: 'Arquivo é obrigatório' }, 400);
    }

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return c.json({ error: 'Tipo de arquivo não suportado' }, 400);
    }

    // Validate file size (2.5GB max for messages)
    const maxSize = 2.5 * 1024 * 1024 * 1024; // 2.5GB
    if (file.size > maxSize) {
      return c.json({ error: 'Arquivo muito grande (máximo 2.5GB)' }, 400);
    }

    const mediaType = isVideo ? 'video' : 'image';
    const result = await uploadFile(file, mediaType, creator.id);

    // Note: thumbnails are not auto-generated, would need separate processing
    return c.json({
      url: result.url,
      thumbnailUrl: null,
      type: mediaType,
    });
  } catch (error) {
    console.error('Error uploading message media:', error);
    return c.json({ error: 'Erro ao fazer upload do arquivo' }, 500);
  }
});

export default messages;
