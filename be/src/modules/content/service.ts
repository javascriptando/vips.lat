import { db } from '@/db';
import { contents, likes, contentPurchases, creators, subscriptions, users, bookmarks, favorites } from '@/db/schema';
import type { MediaItem } from '@/db/schema/content';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { uploadFile, deleteFile } from '@/lib/storage';
import type { CreateContentInput, UpdateContentInput, ListContentInput } from './schemas';

// Normalize media URLs to use relative paths
function normalizeMediaUrls(media: MediaItem[] | null): MediaItem[] {
  if (!media || !Array.isArray(media)) return [];
  return media.map(item => ({
    ...item,
    url: item.url.replace(/^https?:\/\/[^\/]+/, ''),
  }));
}

export async function createContent(creatorId: string, input: CreateContentInput, files?: File[]) {
  const media: MediaItem[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const result = await uploadFile(file, type, creatorId);
      media.push({
        path: result.path,
        url: result.url,
        type,
        size: result.size,
        mimeType: result.mimeType,
      });
    }
  }

  const [content] = await db
    .insert(contents)
    .values({
      creatorId,
      type: input.type,
      visibility: input.visibility,
      text: input.text,
      media,
      ppvPrice: input.visibility === 'ppv' ? input.ppvPrice : null,
      isPublished: true,
      publishedAt: new Date(),
    })
    .returning();

  // Incrementar contador de posts
  await db
    .update(creators)
    .set({ postCount: sql`${creators.postCount} + 1`, updatedAt: new Date() })
    .where(eq(creators.id, creatorId));

  return content;
}

export async function getContentById(contentId: string, userId?: string) {
  const content = await db.query.contents.findFirst({
    where: eq(contents.id, contentId),
  });

  if (!content) return null;

  // Verificar se usuário tem acesso
  let hasAccess = content.visibility === 'public';
  let hasPurchased = false;
  let hasLiked = false;
  let hasBookmarked = false;

  if (userId) {
    // Verificar bookmark
    const bookmark = await db.query.bookmarks.findFirst({
      where: and(eq(bookmarks.userId, userId), eq(bookmarks.contentId, contentId)),
    });
    hasBookmarked = !!bookmark;

    // Verificar like
    const like = await db.query.likes.findFirst({
      where: and(eq(likes.userId, userId), eq(likes.contentId, contentId)),
    });
    hasLiked = !!like;
  }

  if (userId && !hasAccess) {
    // Verificar assinatura
    if (content.visibility === 'subscribers') {
      const sub = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.subscriberId, userId),
          eq(subscriptions.creatorId, content.creatorId),
          eq(subscriptions.status, 'active')
        ),
      });
      hasAccess = !!sub;
    }

    // Verificar compra PPV
    if (content.visibility === 'ppv') {
      const purchase = await db.query.contentPurchases.findFirst({
        where: and(
          eq(contentPurchases.userId, userId),
          eq(contentPurchases.contentId, contentId)
        ),
      });
      hasPurchased = !!purchase;
      hasAccess = hasPurchased;
    }
  }

  // Buscar informações do criador
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, content.creatorId),
  });

  // Buscar dados do usuário do criador para username/avatar
  let creatorInfo = null;
  if (creator) {
    const creatorUser = await db.query.users.findFirst({ where: eq(users.id, creator.userId) });
    if (creatorUser) {
      creatorInfo = {
        displayName: creator.displayName,
        bio: creator.bio,
        isPro: creator.isPro,
        verified: creator.verified,
        subscriberCount: creator.subscriberCount,
        username: creatorUser.username,
        avatarUrl: creatorUser.avatarUrl,
      };
    }

    // Verificar se é o próprio criador
    if (userId && creator.userId === userId) {
      hasAccess = true;
    }
  }

  return {
    ...content,
    hasAccess,
    hasPurchased,
    hasLiked,
    hasBookmarked,
    media: hasAccess ? normalizeMediaUrls(content.media) : [], // Esconder mídia se não tem acesso
    creator: creatorInfo,
  };
}

export async function updateContent(contentId: string, creatorId: string, input: UpdateContentInput) {
  const content = await db.query.contents.findFirst({
    where: and(eq(contents.id, contentId), eq(contents.creatorId, creatorId)),
  });

  if (!content) throw new Error('Conteúdo não encontrado');

  const [updated] = await db
    .update(contents)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(contents.id, contentId))
    .returning();

  return updated;
}

export async function deleteContent(contentId: string, creatorId: string) {
  const content = await db.query.contents.findFirst({
    where: and(eq(contents.id, contentId), eq(contents.creatorId, creatorId)),
  });

  if (!content) throw new Error('Conteúdo não encontrado');

  // Deletar arquivos de mídia
  if (content.media) {
    for (const item of content.media as MediaItem[]) {
      await deleteFile(item.path);
    }
  }

  await db.delete(contents).where(eq(contents.id, contentId));

  // Decrementar contador
  await db
    .update(creators)
    .set({ postCount: sql`${creators.postCount} - 1`, updatedAt: new Date() })
    .where(eq(creators.id, creatorId));
}

export async function listCreatorContent(creatorId: string, input: ListContentInput, userId?: string) {
  const { page, pageSize, visibility } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(contents.creatorId, creatorId), eq(contents.isPublished, true)];
  if (visibility !== 'all') {
    conditions.push(eq(contents.visibility, visibility));
  }

  const contentList = await db
    .select()
    .from(contents)
    .where(and(...conditions))
    .orderBy(desc(contents.publishedAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contents)
    .where(and(...conditions));

  // Processar acesso para cada conteúdo
  const processedContent = await Promise.all(
    contentList.map(async (content) => {
      const result = await getContentById(content.id, userId);
      return result;
    })
  );

  return {
    data: processedContent.filter(Boolean),
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function getFeed(userId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  // Buscar criadores que o usuário segue (favorites)
  const followedCreators = await db
    .select({ creatorId: favorites.creatorId })
    .from(favorites)
    .where(eq(favorites.userId, userId));

  // Buscar criadores que o usuário assina
  const activeSubscriptions = await db
    .select({ creatorId: subscriptions.creatorId })
    .from(subscriptions)
    .where(and(eq(subscriptions.subscriberId, userId), eq(subscriptions.status, 'active')));

  // Combinar criadores seguidos e assinados (sem duplicatas)
  const creatorIdSet = new Set<string>();
  followedCreators.forEach(f => creatorIdSet.add(f.creatorId));
  activeSubscriptions.forEach(s => creatorIdSet.add(s.creatorId));

  const creatorIds = Array.from(creatorIdSet);

  if (creatorIds.length === 0) {
    return { data: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
  }

  // Para criadores seguidos sem assinatura, mostrar apenas conteúdo público
  const subscribedIds = new Set(activeSubscriptions.map(s => s.creatorId));

  const contentList = await db
    .select()
    .from(contents)
    .where(and(
      inArray(contents.creatorId, creatorIds),
      eq(contents.isPublished, true)
    ))
    .orderBy(desc(contents.publishedAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contents)
    .where(and(
      inArray(contents.creatorId, creatorIds),
      eq(contents.isPublished, true)
    ));

  const processedContent = await Promise.all(
    contentList.map(async (content) => getContentById(content.id, userId))
  );

  return {
    data: processedContent.filter(Boolean),
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function likeContent(contentId: string, userId: string) {
  const existing = await db.query.likes.findFirst({
    where: and(eq(likes.contentId, contentId), eq(likes.userId, userId)),
  });

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
    await db.update(contents).set({ likeCount: sql`${contents.likeCount} - 1` }).where(eq(contents.id, contentId));
    return { liked: false };
  }

  await db.insert(likes).values({ contentId, userId });
  await db.update(contents).set({ likeCount: sql`${contents.likeCount} + 1` }).where(eq(contents.id, contentId));
  return { liked: true };
}

export async function incrementViewCount(contentId: string) {
  await db.update(contents).set({ viewCount: sql`${contents.viewCount} + 1` }).where(eq(contents.id, contentId));
}

// Feed de exploração público (conteúdo público de todos os criadores)
export type FeedSortBy = 'recent' | 'trending' | 'top';

export async function getExploreFeed(
  page = 1,
  pageSize = 20,
  userId?: string,
  sortBy: FeedSortBy = 'recent'
) {
  const offset = (page - 1) * pageSize;

  // Definir ordenação baseado no tipo
  let orderByClause;
  switch (sortBy) {
    case 'trending':
      // Score baseado em engajamento recente (likes + views ponderados pela idade)
      orderByClause = sql`(${contents.likeCount} * 2 + ${contents.viewCount}) / (EXTRACT(EPOCH FROM (NOW() - ${contents.publishedAt})) / 3600 + 1) DESC`;
      break;
    case 'top':
      // Mais curtidos de todos os tempos
      orderByClause = desc(contents.likeCount);
      break;
    case 'recent':
    default:
      orderByClause = desc(contents.publishedAt);
  }

  const contentList = await db
    .select({
      id: contents.id,
      creatorId: contents.creatorId,
      type: contents.type,
      visibility: contents.visibility,
      text: contents.text,
      media: contents.media,
      viewCount: contents.viewCount,
      likeCount: contents.likeCount,
      publishedAt: contents.publishedAt,
      createdAt: contents.createdAt,
      // Creator info
      creatorDisplayName: creators.displayName,
      creatorBio: creators.bio,
      creatorCoverUrl: creators.coverUrl,
      creatorIsPro: creators.isPro,
      creatorVerified: creators.verified,
      creatorSubscriberCount: creators.subscriberCount,
      // User info
      creatorUsername: users.username,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(contents)
    .innerJoin(creators, eq(creators.id, contents.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(and(
      eq(contents.visibility, 'public'),
      eq(contents.isPublished, true),
      eq(creators.isActive, true)
    ))
    .orderBy(orderByClause)
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contents)
    .innerJoin(creators, eq(creators.id, contents.creatorId))
    .where(and(
      eq(contents.visibility, 'public'),
      eq(contents.isPublished, true),
      eq(creators.isActive, true)
    ));

  // Processar likes e bookmarks do usuário
  let userLikes: Set<string> = new Set();
  let userBookmarks: Set<string> = new Set();
  if (userId) {
    const [userLikesList, userBookmarksList] = await Promise.all([
      db.select({ contentId: likes.contentId }).from(likes).where(eq(likes.userId, userId)),
      db.select({ contentId: bookmarks.contentId }).from(bookmarks).where(eq(bookmarks.userId, userId)),
    ]);
    userLikes = new Set(userLikesList.map(l => l.contentId));
    userBookmarks = new Set(userBookmarksList.map(b => b.contentId));
  }

  const processedContent = contentList.map(content => ({
    id: content.id,
    creatorId: content.creatorId,
    type: content.type,
    visibility: content.visibility,
    text: content.text,
    media: normalizeMediaUrls(content.media as MediaItem[]),
    viewCount: content.viewCount,
    likeCount: content.likeCount,
    publishedAt: content.publishedAt,
    createdAt: content.createdAt,
    hasAccess: true,
    hasLiked: userLikes.has(content.id),
    hasBookmarked: userBookmarks.has(content.id),
    creator: {
      displayName: content.creatorDisplayName,
      bio: content.creatorBio,
      coverUrl: content.creatorCoverUrl,
      isPro: content.creatorIsPro,
      verified: content.creatorVerified,
      subscriberCount: content.creatorSubscriberCount,
      username: content.creatorUsername,
      avatarUrl: content.creatorAvatarUrl,
    },
  }));

  return {
    data: processedContent,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
    sortBy,
  };
}

// Conteúdo em alta (mais curtidos/visualizados)
export async function getTrendingContent(limit = 20) {
  const trending = await db
    .select({
      id: contents.id,
      creatorId: contents.creatorId,
      type: contents.type,
      visibility: contents.visibility,
      text: contents.text,
      media: contents.media,
      viewCount: contents.viewCount,
      likeCount: contents.likeCount,
      publishedAt: contents.publishedAt,
      creatorDisplayName: creators.displayName,
      creatorUsername: users.username,
      creatorAvatarUrl: users.avatarUrl,
      creatorIsPro: creators.isPro,
      creatorVerified: creators.verified,
    })
    .from(contents)
    .innerJoin(creators, eq(creators.id, contents.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(and(
      eq(contents.visibility, 'public'),
      eq(contents.isPublished, true),
      eq(creators.isActive, true)
    ))
    .orderBy(desc(contents.likeCount), desc(contents.viewCount))
    .limit(limit);

  return trending.map(content => ({
    id: content.id,
    creatorId: content.creatorId,
    type: content.type,
    text: content.text,
    media: normalizeMediaUrls(content.media as MediaItem[]),
    viewCount: content.viewCount,
    likeCount: content.likeCount,
    publishedAt: content.publishedAt,
    hasAccess: true,
    creator: {
      displayName: content.creatorDisplayName,
      username: content.creatorUsername,
      avatarUrl: content.creatorAvatarUrl,
      isPro: content.creatorIsPro,
      verified: content.creatorVerified,
    },
  }));
}

// Conteúdo comprado pelo usuário (PPV)
export async function getPurchasedContent(userId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const purchased = await db
    .select({
      id: contents.id,
      creatorId: contents.creatorId,
      type: contents.type,
      visibility: contents.visibility,
      text: contents.text,
      media: contents.media,
      ppvPrice: contents.ppvPrice,
      viewCount: contents.viewCount,
      likeCount: contents.likeCount,
      commentCount: contents.commentCount,
      publishedAt: contents.publishedAt,
      createdAt: contents.createdAt,
      creatorDisplayName: creators.displayName,
      creatorUsername: users.username,
      creatorAvatarUrl: users.avatarUrl,
      creatorVerified: creators.verified,
    })
    .from(contentPurchases)
    .innerJoin(contents, eq(contents.id, contentPurchases.contentId))
    .innerJoin(creators, eq(creators.id, contents.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(eq(contentPurchases.userId, userId))
    .orderBy(desc(contentPurchases.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentPurchases)
    .where(eq(contentPurchases.userId, userId));

  const processedContent = purchased.map(content => ({
    id: content.id,
    creatorId: content.creatorId,
    type: content.type,
    visibility: content.visibility,
    text: content.text,
    media: normalizeMediaUrls(content.media as MediaItem[]),
    ppvPrice: content.ppvPrice,
    viewCount: content.viewCount,
    likeCount: content.likeCount,
    commentCount: content.commentCount,
    publishedAt: content.publishedAt,
    createdAt: content.createdAt,
    hasAccess: true,
    hasPurchased: true,
    hasLiked: false,
    hasBookmarked: false,
    creator: {
      id: content.creatorId,
      displayName: content.creatorDisplayName,
      username: content.creatorUsername,
      avatar: content.creatorAvatarUrl,
      isVerified: content.creatorVerified,
    },
  }));

  return {
    data: processedContent,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}
