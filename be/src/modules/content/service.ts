import { db } from '@/db';
import { contents, likes, contentPurchases, creators, subscriptions, users, bookmarks, favorites } from '@/db/schema';
import type { MediaItem } from '@/db/schema/content';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { uploadFile, deleteFile } from '@/lib/storage';
import { broadcastContentCreated, notifyNewLike, broadcastLike, broadcastComment } from '@/lib/websocket';
import type { CreateContentInput, UpdateContentInput, ListContentInput } from './schemas';

// Ensure media array is valid (keeping full S3 URLs)
function normalizeMediaUrls(media: MediaItem[] | null): MediaItem[] {
  if (!media || !Array.isArray(media)) return [];
  return media;
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

  // Broadcast para atualizar feeds em tempo real
  broadcastContentCreated(creatorId, content.id);

  return content;
}

// Create content with pre-uploaded media (from chunked upload)
export async function createContentWithMedia(
  creatorId: string,
  input: CreateContentInput,
  media: Array<{
    path: string;
    url: string;
    size: number;
    mimeType: string;
    type: 'image' | 'video';
    isPPV?: boolean;
    ppvPrice?: number;
  }>
) {
  const mediaItems: MediaItem[] = media.map((m, index) => ({
    path: m.path,
    url: m.url,
    type: m.type,
    size: m.size,
    mimeType: m.mimeType,
    order: index,
    ppvPrice: m.isPPV ? m.ppvPrice : undefined,
  }));

  const [content] = await db
    .insert(contents)
    .values({
      creatorId,
      type: input.type,
      visibility: input.visibility,
      text: input.text,
      media: mediaItems,
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

  // Broadcast para atualizar feeds em tempo real
  broadcastContentCreated(creatorId, content.id);

  return content;
}

export async function getContentById(contentId: string, userId?: string) {
  const content = await db.query.contents.findFirst({
    where: eq(contents.id, contentId),
  });

  if (!content) return null;

  // Verificar se usuário tem acesso ao conteúdo
  let hasAccess = content.visibility === 'public';
  let hasPurchased = false;
  let hasLiked = false;
  let hasBookmarked = false;
  let isOwner = false;

  // Get all purchases for this content (content-level and per-media)
  let userPurchases: { mediaIndex: number | null }[] = [];

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

    // Get all purchases for this user/content
    userPurchases = await db
      .select({ mediaIndex: contentPurchases.mediaIndex })
      .from(contentPurchases)
      .where(and(
        eq(contentPurchases.userId, userId),
        eq(contentPurchases.contentId, contentId)
      ));
  }

  // Check content-level purchase (mediaIndex = null)
  const hasContentPurchase = userPurchases.some(p => p.mediaIndex === null);

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

    // Verificar compra PPV (content-level)
    if (content.visibility === 'ppv') {
      hasPurchased = hasContentPurchase;
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
        id: creator.id,
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
      isOwner = true;
    }
  }

  // Count media types (always available for stats, even when locked)
  const rawMedia = content.media as MediaItem[] | null;
  const mediaCount = {
    photos: rawMedia?.filter(m => m.type === 'image').length || 0,
    videos: rawMedia?.filter(m => m.type === 'video').length || 0,
    total: rawMedia?.length || 0,
  };

  // Process media with per-item access control
  const purchasedMediaIndexes = new Set(
    userPurchases.filter(p => p.mediaIndex !== null).map(p => p.mediaIndex as number)
  );

  const processedMedia = hasAccess
    ? normalizeMediaUrls(rawMedia).map((item, index) => {
        const itemHasPPV = item.ppvPrice && item.ppvPrice > 0;
        const itemPurchased = purchasedMediaIndexes.has(index) || hasContentPurchase;
        const itemHasAccess = isOwner || !itemHasPPV || itemPurchased;

        return {
          ...item,
          url: itemHasAccess ? item.url : '', // Hide URL if not purchased
          hasAccess: itemHasAccess,
        };
      })
    : []; // Hide all media if no content-level access

  return {
    ...content,
    hasAccess,
    hasPurchased,
    isLiked: hasLiked,
    hasBookmarked,
    media: processedMedia,
    mediaCount,
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

  let newLikeCount: number;

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
    const [updated] = await db
      .update(contents)
      .set({ likeCount: sql`${contents.likeCount} - 1` })
      .where(eq(contents.id, contentId))
      .returning({ likeCount: contents.likeCount });
    newLikeCount = updated?.likeCount ?? 0;
    return { liked: false, likeCount: newLikeCount };
  }

  await db.insert(likes).values({ contentId, userId });
  const [updated] = await db
    .update(contents)
    .set({ likeCount: sql`${contents.likeCount} + 1` })
    .where(eq(contents.id, contentId))
    .returning({ likeCount: contents.likeCount });
  newLikeCount = updated?.likeCount ?? 0;

  // Get user info and content for notifications
  const [content, user] = await Promise.all([
    db.query.contents.findFirst({ where: eq(contents.id, contentId) }),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
  ]);

  if (content && user) {
    // Notify creator
    notifyNewLike(content.creatorId, contentId, userId);
    // Broadcast to all viewers for real-time effect
    broadcastLike(contentId, userId, user.name || user.username || 'Anônimo');
  }

  return { liked: true, likeCount: newLikeCount };
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

  // Get per-media purchases for the user (for PPV items in public content)
  let userMediaPurchases = new Map<string, Set<number>>();
  if (userId) {
    const contentIds = contentList.map(c => c.id);
    if (contentIds.length > 0) {
      const purchases = await db
        .select({ contentId: contentPurchases.contentId, mediaIndex: contentPurchases.mediaIndex })
        .from(contentPurchases)
        .where(and(
          eq(contentPurchases.userId, userId),
          inArray(contentPurchases.contentId, contentIds)
        ));

      for (const p of purchases) {
        if (!userMediaPurchases.has(p.contentId)) {
          userMediaPurchases.set(p.contentId, new Set());
        }
        if (p.mediaIndex !== null) {
          userMediaPurchases.get(p.contentId)!.add(p.mediaIndex);
        }
      }
    }
  }

  const processedContent = contentList.map(content => {
    const rawMedia = normalizeMediaUrls(content.media as MediaItem[]);
    const purchasedIndexes = userMediaPurchases.get(content.id) || new Set<number>();
    const hasContentPurchase = purchasedIndexes.has(-1) || userMediaPurchases.get(content.id)?.size === 0 && userMediaPurchases.has(content.id);

    // Process per-media PPV for public content
    const processedMedia = rawMedia.map((item, index) => {
      const itemHasPPV = item.ppvPrice && item.ppvPrice > 0;
      const itemPurchased = purchasedIndexes.has(index) || hasContentPurchase;
      const itemHasAccess = !itemHasPPV || itemPurchased;

      return {
        ...item,
        url: itemHasAccess ? item.url : '', // Hide URL if not purchased
        hasAccess: itemHasAccess,
      };
    });

    return {
      id: content.id,
      creatorId: content.creatorId,
      type: content.type,
      visibility: content.visibility,
      text: content.text,
      media: processedMedia,
      viewCount: content.viewCount,
      likeCount: content.likeCount,
      publishedAt: content.publishedAt,
      createdAt: content.createdAt,
      hasAccess: true,
      isLiked: userLikes.has(content.id),
      hasBookmarked: userBookmarks.has(content.id),
      creator: {
        id: content.creatorId,
        displayName: content.creatorDisplayName,
        bio: content.creatorBio,
        coverUrl: content.creatorCoverUrl,
        isPro: content.creatorIsPro,
        verified: content.creatorVerified,
        subscriberCount: content.creatorSubscriberCount,
        username: content.creatorUsername,
        avatarUrl: content.creatorAvatarUrl,
      },
    };
  });

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
      id: content.creatorId,
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

  const processedContent = purchased.map(content => {
    // Mark all media items as accessible since user purchased this content
    const mediaWithAccess = normalizeMediaUrls(content.media as MediaItem[]).map(m => ({
      ...m,
      hasAccess: true,
    }));

    return {
      id: content.id,
      creatorId: content.creatorId,
      type: content.type,
      visibility: content.visibility,
      text: content.text,
      media: mediaWithAccess,
      ppvPrice: content.ppvPrice,
      viewCount: content.viewCount,
      likeCount: content.likeCount,
      commentCount: content.commentCount,
      publishedAt: content.publishedAt,
      createdAt: content.createdAt,
      hasAccess: true,
      hasPurchased: true,
      isLiked: false,
      hasBookmarked: false,
      creator: {
        id: content.creatorId,
        displayName: content.creatorDisplayName,
        username: content.creatorUsername,
        avatarUrl: content.creatorAvatarUrl,
        isVerified: content.creatorVerified,
      },
    };
  });

  return {
    data: processedContent,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}
