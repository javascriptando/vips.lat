import { db } from '@/db';
import { subscriptions, creators, users, SUBSCRIPTION_MULTIPLIERS } from '@/db/schema';
import type { SubscriptionDuration } from '@/db/schema/subscriptions';
import { eq, and, desc, sql } from 'drizzle-orm';
import { notifyNewSubscriber, sendInvalidation } from '@/lib/websocket';
import type { ListSubscriptionsInput } from './schemas';

// Calcula a data de expiração baseada na duração
function calculateExpiryDate(duration: SubscriptionDuration): Date {
  const months = parseInt(duration);
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + months);
  return expiry;
}

// Calcula o preço total com desconto baseado na duração
export function calculateSubscriptionPrice(monthlyPrice: number, duration: SubscriptionDuration): number {
  const multiplier = SUBSCRIPTION_MULTIPLIERS[duration];
  return Math.round(monthlyPrice * multiplier);
}

export async function getSubscription(subscriberId: string, creatorId: string) {
  return db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.subscriberId, subscriberId),
      eq(subscriptions.creatorId, creatorId)
    ),
  });
}

export async function getSubscriptionById(subscriptionId: string, subscriberId: string) {
  return db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.id, subscriptionId),
      eq(subscriptions.subscriberId, subscriberId)
    ),
  });
}

export async function getActiveSubscription(subscriberId: string, creatorId: string) {
  return db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.subscriberId, subscriberId),
      eq(subscriptions.creatorId, creatorId),
      eq(subscriptions.status, 'active')
    ),
  });
}

// Criar assinatura diretamente como ativa (PIX é instantâneo)
export async function createSubscription(
  subscriberId: string,
  creatorId: string,
  price: number,
  duration: SubscriptionDuration = '1',
  asaasPaymentId?: string
) {
  // Verificar se já existe assinatura ativa
  const existing = await getActiveSubscription(subscriberId, creatorId);
  if (existing) {
    throw new Error('Você já possui uma assinatura ativa com este criador');
  }

  const expiresAt = calculateExpiryDate(duration);

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      subscriberId,
      creatorId,
      priceAtPurchase: price,
      duration,
      status: 'active',
      startsAt: new Date(),
      expiresAt,
      asaasPaymentId,
    })
    .returning();

  // Incrementar contador do criador
  await db
    .update(creators)
    .set({ subscriberCount: sql`${creators.subscriberCount} + 1`, updatedAt: new Date() })
    .where(eq(creators.id, creatorId));

  // Notificar o criador em tempo real
  const subscriber = await db.query.users.findFirst({ where: eq(users.id, subscriberId) });
  if (subscriber) {
    notifyNewSubscriber(creatorId, subscriberId, subscriber.name || subscriber.username);
  }

  // Enviar invalidação para o assinante atualizar suas assinaturas
  sendInvalidation(subscriberId, ['subscriptions', 'subscription-status']);

  return subscription;
}

// Renovar assinatura existente
export async function renewSubscription(
  subscriptionId: string,
  duration: SubscriptionDuration = '1',
  price: number,
  asaasPaymentId?: string
) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, subscriptionId),
  });

  if (!subscription) throw new Error('Assinatura não encontrada');

  // Se a assinatura expirou, calcular a partir de agora
  // Se ainda está ativa, adicionar ao tempo restante
  let newExpiresAt: Date;
  const now = new Date();

  if (subscription.expiresAt && subscription.expiresAt > now) {
    // Adiciona ao tempo existente
    newExpiresAt = new Date(subscription.expiresAt);
    newExpiresAt.setMonth(newExpiresAt.getMonth() + parseInt(duration));
  } else {
    // Começa a contar a partir de agora
    newExpiresAt = calculateExpiryDate(duration);
  }

  const [updated] = await db
    .update(subscriptions)
    .set({
      status: 'active',
      duration,
      priceAtPurchase: price,
      expiresAt: newExpiresAt,
      asaasPaymentId,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  // Se estava expirada/cancelada, incrementar contador
  if (subscription.status !== 'active') {
    await db
      .update(creators)
      .set({ subscriberCount: sql`${creators.subscriberCount} + 1`, updatedAt: new Date() })
      .where(eq(creators.id, subscription.creatorId));
  }

  return updated;
}

export async function cancelSubscription(subscriptionId: string, subscriberId: string) {
  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.id, subscriptionId),
      eq(subscriptions.subscriberId, subscriberId)
    ),
  });

  if (!subscription) throw new Error('Assinatura não encontrada');
  if (subscription.status !== 'active') throw new Error('Assinatura não está ativa');

  const [updated] = await db
    .update(subscriptions)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  // Decrementar contador
  await db
    .update(creators)
    .set({ subscriberCount: sql`${creators.subscriberCount} - 1`, updatedAt: new Date() })
    .where(eq(creators.id, subscription.creatorId));

  return updated;
}

export async function listUserSubscriptions(userId: string, input: ListSubscriptionsInput) {
  const { page, pageSize, status } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(subscriptions.subscriberId, userId)];
  if (status !== 'all') {
    conditions.push(eq(subscriptions.status, status as 'active' | 'cancelled' | 'expired' | 'pending'));
  } else {
    // Por padrão, não mostrar subscriptions 'pending' (pagamentos não concluídos)
    conditions.push(sql`${subscriptions.status} != 'pending'`);
  }

  const subs = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      duration: subscriptions.duration,
      priceAtPurchase: subscriptions.priceAtPurchase,
      startsAt: subscriptions.startsAt,
      expiresAt: subscriptions.expiresAt,
      createdAt: subscriptions.createdAt,
      creatorId: creators.id,
      displayName: creators.displayName,
      coverUrl: creators.coverUrl,
      verified: creators.verified,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(subscriptions)
    .innerJoin(creators, eq(creators.id, subscriptions.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(and(...conditions))
    .orderBy(desc(subscriptions.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(and(...conditions));

  return {
    data: subs,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function listCreatorSubscribers(creatorId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const subs = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      duration: subscriptions.duration,
      startsAt: subscriptions.startsAt,
      expiresAt: subscriptions.expiresAt,
      userId: users.id,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.subscriberId))
    .where(and(eq(subscriptions.creatorId, creatorId), eq(subscriptions.status, 'active')))
    .orderBy(desc(subscriptions.startsAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(and(eq(subscriptions.creatorId, creatorId), eq(subscriptions.status, 'active')));

  return {
    data: subs,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function checkExpiredSubscriptions() {
  // Buscar assinaturas expiradas
  const expired = await db
    .update(subscriptions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(
      eq(subscriptions.status, 'active'),
      sql`${subscriptions.expiresAt} < NOW()`
    ))
    .returning();

  // Atualizar contadores
  for (const sub of expired) {
    await db
      .update(creators)
      .set({ subscriberCount: sql`${creators.subscriberCount} - 1`, updatedAt: new Date() })
      .where(eq(creators.id, sub.creatorId));
  }

  return expired.length;
}

// Obter opções de planos para um criador
export function getSubscriptionPlans(monthlyPrice: number) {
  return {
    monthly: {
      duration: '1' as SubscriptionDuration,
      months: 1,
      price: calculateSubscriptionPrice(monthlyPrice, '1'),
      monthlyPrice: monthlyPrice,
      discount: 0,
      label: '1 mês',
    },
    quarterly: {
      duration: '3' as SubscriptionDuration,
      months: 3,
      price: calculateSubscriptionPrice(monthlyPrice, '3'),
      monthlyPrice: Math.round(calculateSubscriptionPrice(monthlyPrice, '3') / 3),
      discount: 10,
      label: '3 meses',
    },
    semiannual: {
      duration: '6' as SubscriptionDuration,
      months: 6,
      price: calculateSubscriptionPrice(monthlyPrice, '6'),
      monthlyPrice: Math.round(calculateSubscriptionPrice(monthlyPrice, '6') / 6),
      discount: 15,
      label: '6 meses',
    },
    annual: {
      duration: '12' as SubscriptionDuration,
      months: 12,
      price: calculateSubscriptionPrice(monthlyPrice, '12'),
      monthlyPrice: Math.round(calculateSubscriptionPrice(monthlyPrice, '12') / 12),
      discount: 20,
      label: '1 ano',
    },
  };
}
