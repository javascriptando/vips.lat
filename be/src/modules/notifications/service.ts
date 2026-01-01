import { db } from '@/db';
import { notifications, users } from '@/db/schema';
import type { NewNotification } from '@/db/schema/social';
import { eq, desc, and, sql } from 'drizzle-orm';
import { sendInvalidation } from '@/lib/websocket';

export async function createNotification(data: NewNotification) {
  const [notification] = await db
    .insert(notifications)
    .values(data)
    .returning();

  // Enviar atualização em tempo real via WebSocket
  sendInvalidation(data.userId, ['notifications', 'unread-count']);

  return notification;
}

export async function getNotifications(userId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const notificationList = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      isRead: notifications.isRead,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      fromUserId: notifications.fromUserId,
      contentId: notifications.contentId,
      creatorId: notifications.creatorId,
      metadata: notifications.metadata,
      // From user info
      fromUserName: users.name,
      fromUserUsername: users.username,
      fromUserAvatarUrl: users.avatarUrl,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.fromUserId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const processedNotifications = notificationList.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    readAt: n.readAt,
    createdAt: n.createdAt,
    contentId: n.contentId,
    creatorId: n.creatorId,
    metadata: n.metadata ? JSON.parse(n.metadata) : null,
    fromUser: n.fromUserId ? {
      id: n.fromUserId,
      name: n.fromUserName,
      username: n.fromUserUsername,
      avatarUrl: n.fromUserAvatarUrl,
    } : null,
  }));

  return {
    data: processedNotifications,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function getUnreadCount(userId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return count;
}

export async function markAsRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning();

  return updated;
}

export async function markAllAsRead(userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function deleteNotification(notificationId: string, userId: string) {
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

// Helper functions to create specific notification types
export async function notifyNewSubscriber(creatorUserId: string, subscriberUserId: string) {
  const subscriber = await db.query.users.findFirst({ where: eq(users.id, subscriberUserId) });
  if (!subscriber) return;

  await createNotification({
    userId: creatorUserId,
    type: 'new_subscriber',
    title: 'Novo Assinante!',
    message: `${subscriber.name || subscriber.username} assinou seu perfil`,
    fromUserId: subscriberUserId,
  });
}

export async function notifyNewLike(contentOwnerId: string, likerId: string, contentId: string) {
  const liker = await db.query.users.findFirst({ where: eq(users.id, likerId) });
  if (!liker || contentOwnerId === likerId) return;

  await createNotification({
    userId: contentOwnerId,
    type: 'new_like',
    title: 'Nova Curtida!',
    message: `${liker.name || liker.username} curtiu seu conteúdo`,
    fromUserId: likerId,
    contentId,
  });
}

export async function notifyNewComment(contentOwnerId: string, commenterId: string, contentId: string) {
  const commenter = await db.query.users.findFirst({ where: eq(users.id, commenterId) });
  if (!commenter || contentOwnerId === commenterId) return;

  await createNotification({
    userId: contentOwnerId,
    type: 'new_comment',
    title: 'Novo Comentário!',
    message: `${commenter.name || commenter.username} comentou em seu conteúdo`,
    fromUserId: commenterId,
    contentId,
  });
}

export async function notifyNewTip(creatorUserId: string, tipperId: string, amount: number) {
  const tipper = await db.query.users.findFirst({ where: eq(users.id, tipperId) });
  if (!tipper) return;

  await createNotification({
    userId: creatorUserId,
    type: 'new_tip',
    title: 'Nova Gorjeta!',
    message: `${tipper.name || tipper.username} enviou uma gorjeta de R$ ${(amount / 100).toFixed(2)}`,
    fromUserId: tipperId,
    metadata: JSON.stringify({ amount }),
  });
}

export async function notifyNewContent(subscriberUserId: string, creatorId: string, contentId: string, creatorName: string) {
  await createNotification({
    userId: subscriberUserId,
    type: 'new_content',
    title: 'Novo Conteúdo!',
    message: `${creatorName} publicou novo conteúdo`,
    creatorId,
    contentId,
  });
}

export async function notifyPaymentReceived(creatorUserId: string, amount: number, type: string) {
  await createNotification({
    userId: creatorUserId,
    type: 'payment_received',
    title: 'Pagamento Recebido!',
    message: `Você recebeu R$ ${(amount / 100).toFixed(2)} de ${type}`,
    metadata: JSON.stringify({ amount, paymentType: type }),
  });
}
