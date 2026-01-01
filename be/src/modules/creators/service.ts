import { db } from '@/db';
import { creators, balances, users, subscriptions, favorites } from '@/db/schema';
import { eq, ilike, desc, asc, sql, and, gte, notInArray } from 'drizzle-orm';
import { uploadFile, deleteFile } from '@/lib/storage';
import { detectPixKeyType } from '@/lib/asaas';
import { sendEmail, welcomeCreatorTemplate } from '@/lib/email';
import { isValidCpfCnpj } from '@/lib/utils';
import type { BecomeCreatorInput, UpdateCreatorInput, ListCreatorsInput } from './schemas';

export async function becomeCreator(userId: string, input: BecomeCreatorInput) {
  const existingCreator = await db.query.creators.findFirst({
    where: eq(creators.userId, userId),
  });

  if (existingCreator) {
    throw new Error('Você já é um criador');
  }

  if (input.cpfCnpj && !isValidCpfCnpj(input.cpfCnpj)) {
    throw new Error('CPF/CNPJ inválido');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const [creator] = await db
    .insert(creators)
    .values({
      userId,
      displayName: input.displayName,
      bio: input.bio,
      subscriptionPrice: input.subscriptionPrice,
      cpfCnpj: input.cpfCnpj?.replace(/\D/g, ''),
    })
    .returning();

  await db.insert(balances).values({
    creatorId: creator.id,
    available: 0,
    pending: 0,
  });

  await db
    .update(users)
    .set({ role: 'creator', updatedAt: new Date() })
    .where(eq(users.id, userId));

  await sendEmail({
    to: user.email,
    subject: 'Bem-vindo ao VIPS Creator!',
    html: welcomeCreatorTemplate(input.displayName),
  });

  return creator;
}

export async function getCreatorByUserId(userId: string) {
  return db.query.creators.findFirst({
    where: eq(creators.userId, userId),
  });
}

export async function getCreatorById(creatorId: string) {
  return db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
  });
}

export async function getCreatorByUsername(username: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username.toLowerCase()),
  });

  if (!user) return null;

  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, user.id),
  });

  if (!creator) return null;

  return { ...creator, username: user.username, avatarUrl: user.avatarUrl };
}

export async function updateCreator(creatorId: string, input: UpdateCreatorInput) {
  const [updatedCreator] = await db
    .update(creators)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(creators.id, creatorId))
    .returning();

  return updatedCreator;
}

export async function updateCover(creatorId: string, file: File) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
  });

  if (!creator) throw new Error('Criador não encontrado');

  const result = await uploadFile(file, 'image', creatorId);

  if (creator.coverUrl) {
    const oldPath = creator.coverUrl.split('/uploads/')[1];
    if (oldPath) await deleteFile(oldPath);
  }

  const [updatedCreator] = await db
    .update(creators)
    .set({ coverUrl: result.url, updatedAt: new Date() })
    .where(eq(creators.id, creatorId))
    .returning();

  return updatedCreator;
}

export async function setPixKey(creatorId: string, pixKey: string) {
  const pixKeyType = detectPixKeyType(pixKey);

  const [updatedCreator] = await db
    .update(creators)
    .set({ asaasPixKey: pixKey, asaasPixKeyType: pixKeyType, updatedAt: new Date() })
    .where(eq(creators.id, creatorId))
    .returning();

  return updatedCreator;
}

export async function listCreators(input: ListCreatorsInput) {
  const { page, pageSize, search, sortBy, sortOrder, minPrice, maxPrice, verified, isPro } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(creators.isActive, true)];

  // Filtros de preço
  if (minPrice !== undefined) {
    conditions.push(sql`${creators.subscriptionPrice} >= ${minPrice}`);
  }
  if (maxPrice !== undefined) {
    conditions.push(sql`${creators.subscriptionPrice} <= ${maxPrice}`);
  }

  // Filtros de status
  if (verified !== undefined) {
    conditions.push(eq(creators.verified, verified));
  }
  if (isPro !== undefined) {
    conditions.push(eq(creators.isPro, isPro));
  }

  const orderColumn = sortBy === 'subscriberCount' ? creators.subscriberCount :
                      sortBy === 'subscriptionPrice' ? creators.subscriptionPrice :
                      creators.createdAt;
  const order = sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn);

  // Busca em displayName, bio e username
  let query = db
    .select({
      id: creators.id,
      displayName: creators.displayName,
      bio: creators.bio,
      coverUrl: creators.coverUrl,
      subscriptionPrice: creators.subscriptionPrice,
      subscriberCount: creators.subscriberCount,
      postCount: creators.postCount,
      isPro: creators.isPro,
      verified: creators.verified,
      createdAt: creators.createdAt,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(creators)
    .innerJoin(users, eq(users.id, creators.userId))
    .where(and(...conditions))
    .orderBy(order)
    .limit(pageSize)
    .offset(offset);

  // Se tem busca, filtra por displayName, bio ou username
  if (search) {
    const searchPattern = `%${search}%`;
    query = db
      .select({
        id: creators.id,
        displayName: creators.displayName,
        bio: creators.bio,
        coverUrl: creators.coverUrl,
        subscriptionPrice: creators.subscriptionPrice,
        subscriberCount: creators.subscriberCount,
        postCount: creators.postCount,
        isPro: creators.isPro,
        verified: creators.verified,
        createdAt: creators.createdAt,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(creators)
      .innerJoin(users, eq(users.id, creators.userId))
      .where(and(
        ...conditions,
        sql`(
          ${creators.displayName} ILIKE ${searchPattern} OR
          ${creators.bio} ILIKE ${searchPattern} OR
          ${users.username} ILIKE ${searchPattern}
        )`
      ))
      .orderBy(order)
      .limit(pageSize)
      .offset(offset);
  }

  const creatorsData = await query;

  // Count query
  let countConditions = [...conditions];
  let countQuery;

  if (search) {
    const searchPattern = `%${search}%`;
    countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(creators)
      .innerJoin(users, eq(users.id, creators.userId))
      .where(and(
        ...countConditions,
        sql`(
          ${creators.displayName} ILIKE ${searchPattern} OR
          ${creators.bio} ILIKE ${searchPattern} OR
          ${users.username} ILIKE ${searchPattern}
        )`
      ));
  } else {
    countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(creators)
      .where(and(...countConditions));
  }

  const [{ count }] = await countQuery;

  return {
    data: creatorsData,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

// Criadores em destaque (mais populares, verificados, PRO)
export async function getFeaturedCreators(limit = 10, excludeUserId?: string) {
  const conditions = [eq(creators.isActive, true)];

  // Nunca mostrar o próprio usuário nas sugestões
  if (excludeUserId) {
    conditions.push(sql`${creators.userId} != ${excludeUserId}`);

    // Excluir criadores que o usuário já segue
    const followedCreators = await db
      .select({ creatorId: favorites.creatorId })
      .from(favorites)
      .where(eq(favorites.userId, excludeUserId));

    if (followedCreators.length > 0) {
      const followedIds = followedCreators.map(f => f.creatorId);
      conditions.push(notInArray(creators.id, followedIds));
    }
  }

  const featured = await db
    .select({
      id: creators.id,
      displayName: creators.displayName,
      bio: creators.bio,
      coverUrl: creators.coverUrl,
      subscriptionPrice: creators.subscriptionPrice,
      subscriberCount: creators.subscriberCount,
      postCount: creators.postCount,
      isPro: creators.isPro,
      verified: creators.verified,
      createdAt: creators.createdAt,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(creators)
    .innerJoin(users, eq(users.id, creators.userId))
    .where(and(...conditions))
    .orderBy(
      desc(creators.verified),
      desc(creators.isPro),
      desc(creators.subscriberCount)
    )
    .limit(limit);

  return featured;
}

// Criadores recentes
export async function getRecentCreators(limit = 10, excludeUserId?: string) {
  const conditions = [eq(creators.isActive, true)];

  // Nunca mostrar o próprio usuário nas sugestões
  if (excludeUserId) {
    conditions.push(sql`${creators.userId} != ${excludeUserId}`);

    // Excluir criadores que o usuário já segue
    const followedCreators = await db
      .select({ creatorId: favorites.creatorId })
      .from(favorites)
      .where(eq(favorites.userId, excludeUserId));

    if (followedCreators.length > 0) {
      const followedIds = followedCreators.map(f => f.creatorId);
      conditions.push(notInArray(creators.id, followedIds));
    }
  }

  const recent = await db
    .select({
      id: creators.id,
      displayName: creators.displayName,
      bio: creators.bio,
      coverUrl: creators.coverUrl,
      subscriptionPrice: creators.subscriptionPrice,
      subscriberCount: creators.subscriberCount,
      postCount: creators.postCount,
      isPro: creators.isPro,
      verified: creators.verified,
      createdAt: creators.createdAt,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(creators)
    .innerJoin(users, eq(users.id, creators.userId))
    .where(and(...conditions))
    .orderBy(desc(creators.createdAt))
    .limit(limit);

  return recent;
}

export async function getCreatorStats(creatorId: string) {
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });
  if (!creator) throw new Error('Criador não encontrado');

  const balance = await db.query.balances.findFirst({ where: eq(balances.creatorId, creatorId) });

  return {
    subscriberCount: creator.subscriberCount,
    postCount: creator.postCount,
    totalEarnings: creator.totalEarnings,
    availableBalance: balance?.available || 0,
    pendingBalance: balance?.pending || 0,
    isPro: creator.isPro,
    verified: creator.verified,
  };
}

export async function getCreatorBalance(creatorId: string) {
  const balance = await db.query.balances.findFirst({ where: eq(balances.creatorId, creatorId) });
  return balance || { available: 0, pending: 0 };
}

export async function getCreatorSubscribers(creatorId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const subs = await db
    .select({
      id: subscriptions.id,
      subscriberId: subscriptions.subscriberId,
      status: subscriptions.status,
      expiresAt: subscriptions.expiresAt,
      createdAt: subscriptions.createdAt,
      priceAtPurchase: subscriptions.priceAtPurchase,
      user: {
        name: users.name,
        username: users.username,
        avatar: users.avatarUrl,
      },
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.subscriberId))
    .where(eq(subscriptions.creatorId, creatorId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.creatorId, creatorId));

  return {
    subscribers: subs,
    total: count,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}
