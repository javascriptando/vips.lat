import { db } from '@/db';
import { conversations, messages, users, creators, subscriptions } from '@/db/schema';
import { eq, and, desc, or, sql } from 'drizzle-orm';
import type { SendMessageInput, ListMessagesInput } from './schemas';
import { broadcastNewMessage } from '@/lib/websocket';

// Verificar se usuário tem assinatura ativa com o criador
export async function hasActiveSubscription(userId: string, creatorId: string): Promise<boolean> {
  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.subscriberId, userId),
      eq(subscriptions.creatorId, creatorId),
      eq(subscriptions.status, 'active')
    ),
  });
  return !!subscription;
}

// Verificar se usuário pode enviar mensagem (é assinante ativo)
export async function canSendMessage(userId: string, creatorId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Buscar o criador para obter o userId dele
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
  });

  if (!creator) {
    return { allowed: false, reason: 'Criador não encontrado' };
  }

  // Se o usuário é o próprio criador, sempre pode enviar
  if (creator.userId === userId) {
    return { allowed: true };
  }

  // Verificar assinatura ativa
  const hasSubscription = await hasActiveSubscription(userId, creatorId);
  if (!hasSubscription) {
    return { allowed: false, reason: 'Você precisa ser assinante para enviar mensagens' };
  }

  // Verificar se o criador bloqueou a conversa
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.userId, userId),
      eq(conversations.creatorId, creatorId)
    ),
  });

  if (conversation?.isBlockedByCreator) {
    return { allowed: false, reason: 'O criador bloqueou esta conversa' };
  }

  return { allowed: true };
}

// Obter ou criar conversa entre usuário e criador
export async function getOrCreateConversation(userId: string, creatorId: string) {
  // Verificar se já existe
  let conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.userId, userId),
      eq(conversations.creatorId, creatorId)
    ),
  });

  if (!conversation) {
    const [newConversation] = await db
      .insert(conversations)
      .values({ userId, creatorId })
      .returning();
    conversation = newConversation;
  }

  return conversation;
}

// Enviar mensagem
export async function sendMessage(senderId: string, input: SendMessageInput) {
  const { creatorId, text, mediaUrl, mediaType } = input;

  // Buscar o criador
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
  });

  if (!creator) {
    throw new Error('Criador não encontrado');
  }

  // Determinar o userId da conversa (sempre o assinante, não o criador)
  const isCreatorSending = creator.userId === senderId;
  let conversationUserId: string;

  if (isCreatorSending) {
    // Criador enviando - precisamos saber para qual usuário
    // Neste caso, precisamos de uma conversa existente ou um userId específico
    throw new Error('Para criadores, use sendMessageToUser');
  } else {
    conversationUserId = senderId;
  }

  // Verificar permissão
  const canSend = await canSendMessage(senderId, creatorId);
  if (!canSend.allowed) {
    throw new Error(canSend.reason);
  }

  // Obter ou criar conversa
  const conversation = await getOrCreateConversation(conversationUserId, creatorId);

  // Criar mensagem
  const preview = text ? text.substring(0, 100) : '[Mídia]';

  const [message] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      senderId,
      text,
      mediaUrl,
      mediaType,
    })
    .returning();

  // Atualizar conversa
  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: preview,
      unreadByCreator: sql`${conversations.unreadByCreator} + 1`,
    })
    .where(eq(conversations.id, conversation.id));

  // Buscar dados do remetente para o WebSocket
  const sender = await db.query.users.findFirst({
    where: eq(users.id, senderId),
  });

  // Broadcast via WebSocket
  if (sender) {
    broadcastNewMessage(conversationUserId, creatorId, {
      id: message.id,
      conversationId: conversation.id,
      senderId: message.senderId,
      senderName: sender.name || sender.username || '',
      senderUsername: sender.username || '',
      senderAvatarUrl: sender.avatarUrl,
      text: message.text,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      createdAt: message.createdAt.toISOString(),
    });
  }

  return message;
}

// Criador envia mensagem para um usuário específico
export async function sendMessageAsCreator(creatorUserId: string, conversationId: string, text?: string, mediaUrl?: string, mediaType?: string) {
  // Verificar que a conversa pertence ao criador
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      creator: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversa não encontrada');
  }

  // Buscar criador pelo userId do remetente
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, creatorUserId),
  });

  if (!creator || creator.id !== conversation.creatorId) {
    throw new Error('Você não tem permissão para enviar nesta conversa');
  }

  const preview = text ? text.substring(0, 100) : '[Mídia]';

  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId: creatorUserId,
      text,
      mediaUrl,
      mediaType,
    })
    .returning();

  // Atualizar conversa
  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: preview,
      unreadByUser: sql`${conversations.unreadByUser} + 1`,
    })
    .where(eq(conversations.id, conversationId));

  // Buscar dados do remetente para o WebSocket
  const sender = await db.query.users.findFirst({
    where: eq(users.id, creatorUserId),
  });

  // Broadcast via WebSocket
  if (sender) {
    broadcastNewMessage(conversation.userId, conversation.creatorId, {
      id: message.id,
      conversationId: conversation.id,
      senderId: message.senderId,
      senderName: sender.name || sender.username || '',
      senderUsername: sender.username || '',
      senderAvatarUrl: sender.avatarUrl,
      text: message.text,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      createdAt: message.createdAt.toISOString(),
    });
  }

  return message;
}

// Listar conversas do usuário
export async function listUserConversations(userId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const convos = await db
    .select({
      id: conversations.id,
      creatorId: conversations.creatorId,
      lastMessageAt: conversations.lastMessageAt,
      lastMessagePreview: conversations.lastMessagePreview,
      unreadCount: conversations.unreadByUser,
      isBlocked: conversations.isBlockedByCreator,
      creatorDisplayName: creators.displayName,
      creatorUsername: users.username,
      creatorAvatarUrl: users.avatarUrl,
      creatorVerified: creators.verified,
    })
    .from(conversations)
    .innerJoin(creators, eq(creators.id, conversations.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(pageSize)
    .offset(offset);

  return convos;
}

// Listar conversas do criador
export async function listCreatorConversations(creatorId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const convos = await db
    .select({
      id: conversations.id,
      userId: conversations.userId,
      lastMessageAt: conversations.lastMessageAt,
      lastMessagePreview: conversations.lastMessagePreview,
      unreadCount: conversations.unreadByCreator,
      isBlocked: conversations.isBlockedByCreator,
      userName: users.name,
      userUsername: users.username,
      userAvatarUrl: users.avatarUrl,
    })
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.userId))
    .where(eq(conversations.creatorId, creatorId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(pageSize)
    .offset(offset);

  return convos;
}

// Listar mensagens de uma conversa
export async function listMessages(userId: string, input: ListMessagesInput) {
  const { conversationId, page, pageSize } = input;
  const offset = (page - 1) * pageSize;

  // Verificar acesso à conversa
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (!conversation) {
    throw new Error('Conversa não encontrada');
  }

  // Verificar se usuário é participante
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, conversation.creatorId),
  });

  const isParticipant = conversation.userId === userId || creator?.userId === userId;
  if (!isParticipant) {
    throw new Error('Você não tem acesso a esta conversa');
  }

  const msgs = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      text: messages.text,
      mediaUrl: messages.mediaUrl,
      mediaType: messages.mediaType,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
      senderName: users.name,
      senderUsername: users.username,
      senderAvatarUrl: users.avatarUrl,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(and(
      eq(messages.conversationId, conversationId),
      eq(messages.isDeleted, false)
    ))
    .orderBy(desc(messages.createdAt))
    .limit(pageSize)
    .offset(offset);

  return msgs.reverse(); // Reverter para ordem cronológica
}

// Marcar mensagens como lidas
export async function markConversationAsRead(userId: string, conversationId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (!conversation) {
    throw new Error('Conversa não encontrada');
  }

  // Verificar quem está lendo
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, conversation.creatorId),
  });

  const isCreator = creator?.userId === userId;
  const isUser = conversation.userId === userId;

  if (!isCreator && !isUser) {
    throw new Error('Você não tem acesso a esta conversa');
  }

  // Atualizar mensagens não lidas
  await db
    .update(messages)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(messages.conversationId, conversationId),
      eq(messages.isRead, false),
      // Marcar apenas mensagens enviadas pelo outro participante
      isCreator
        ? eq(messages.senderId, conversation.userId)
        : sql`${messages.senderId} != ${userId}`
    ));

  // Zerar contador
  await db
    .update(conversations)
    .set(isCreator ? { unreadByCreator: 0 } : { unreadByUser: 0 })
    .where(eq(conversations.id, conversationId));
}

// Contar mensagens não lidas total do usuário
export async function getUnreadCount(userId: string) {
  // Verificar se é criador
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, userId),
  });

  // Mensagens não lidas como usuário
  const userUnread = await db
    .select({ total: sql<number>`COALESCE(SUM(${conversations.unreadByUser}), 0)::int` })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  let creatorUnread = 0;
  if (creator) {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${conversations.unreadByCreator}), 0)::int` })
      .from(conversations)
      .where(eq(conversations.creatorId, creator.id));
    creatorUnread = result[0]?.total || 0;
  }

  return {
    asUser: userUnread[0]?.total || 0,
    asCreator: creatorUnread,
    total: (userUnread[0]?.total || 0) + creatorUnread,
  };
}

// Bloquear/desbloquear conversa (apenas criador)
export async function toggleBlockConversation(creatorUserId: string, conversationId: string) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, creatorUserId),
  });

  if (!creator) {
    throw new Error('Você não é um criador');
  }

  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.creatorId, creator.id)
    ),
  });

  if (!conversation) {
    throw new Error('Conversa não encontrada');
  }

  const [updated] = await db
    .update(conversations)
    .set({ isBlockedByCreator: !conversation.isBlockedByCreator })
    .where(eq(conversations.id, conversationId))
    .returning();

  return updated;
}
