import { db } from '@/db';
import { favorites, bookmarks, creators, contents, users, contentPurchases, subscriptions } from '@/db/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import type { MediaItem } from '@/db/schema/content';

// Favoritos (criadores)
export async function toggleFavorite(userId: string, creatorId: string) {
  const existing = await db.query.favorites.findFirst({
    where: and(eq(favorites.userId, userId), eq(favorites.creatorId, creatorId)),
  });

  if (existing) {
    await db.delete(favorites).where(eq(favorites.id, existing.id));
    return { favorited: false };
  }

  await db.insert(favorites).values({ userId, creatorId });
  return { favorited: true };
}

export async function isFavorited(userId: string, creatorId: string) {
  const existing = await db.query.favorites.findFirst({
    where: and(eq(favorites.userId, userId), eq(favorites.creatorId, creatorId)),
  });
  return !!existing;
}

export async function listFavoriteCreators(userId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const favoriteList = await db
    .select({
      id: favorites.id,
      createdAt: favorites.createdAt,
      creatorId: creators.id,
      displayName: creators.displayName,
      bio: creators.bio,
      coverUrl: creators.coverUrl,
      subscriptionPrice: creators.subscriptionPrice,
      subscriberCount: creators.subscriberCount,
      postCount: creators.postCount,
      isPro: creators.isPro,
      verified: creators.verified,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(favorites)
    .innerJoin(creators, eq(creators.id, favorites.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(favorites)
    .where(eq(favorites.userId, userId));

  const processedFavorites = favoriteList.map(f => ({
    id: f.id,
    favoritedAt: f.createdAt,
    creator: {
      id: f.creatorId,
      displayName: f.displayName,
      bio: f.bio,
      coverUrl: f.coverUrl,
      subscriptionPrice: f.subscriptionPrice,
      subscriberCount: f.subscriberCount,
      postCount: f.postCount,
      isPro: f.isPro,
      verified: f.verified,
      username: f.username,
      avatarUrl: f.avatarUrl,
    },
  }));

  return {
    data: processedFavorites,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

// Bookmarks (conteúdos)
export async function toggleBookmark(userId: string, contentId: string) {
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.contentId, contentId)),
  });

  if (existing) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
    return { bookmarked: false };
  }

  await db.insert(bookmarks).values({ userId, contentId });
  return { bookmarked: true };
}

export async function isBookmarked(userId: string, contentId: string) {
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.contentId, contentId)),
  });
  return !!existing;
}

export async function listBookmarkedContent(userId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const bookmarkList = await db
    .select({
      id: bookmarks.id,
      createdAt: bookmarks.createdAt,
      contentId: contents.id,
      contentType: contents.type,
      contentVisibility: contents.visibility,
      contentPpvPrice: contents.ppvPrice,
      contentText: contents.text,
      contentMedia: contents.media,
      viewCount: contents.viewCount,
      likeCount: contents.likeCount,
      commentCount: contents.commentCount,
      publishedAt: contents.publishedAt,
      contentCreatedAt: contents.createdAt,
      creatorId: creators.id,
      creatorDisplayName: creators.displayName,
      creatorUsername: users.username,
      creatorAvatarUrl: users.avatarUrl,
      creatorIsPro: creators.isPro,
      creatorVerified: creators.verified,
    })
    .from(bookmarks)
    .innerJoin(contents, eq(contents.id, bookmarks.contentId))
    .innerJoin(creators, eq(creators.id, contents.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId));

  // Get all content IDs to check purchases
  const contentIds = bookmarkList.map(b => b.contentId);

  // Get all purchases for these contents
  const userPurchases = contentIds.length > 0 ? await db
    .select({ contentId: contentPurchases.contentId, mediaIndex: contentPurchases.mediaIndex })
    .from(contentPurchases)
    .where(and(
      eq(contentPurchases.userId, userId),
      inArray(contentPurchases.contentId, contentIds)
    )) : [];

  // Get all creator IDs to check subscriptions
  const creatorIds = [...new Set(bookmarkList.map(b => b.creatorId))];

  // Get active subscriptions
  const activeSubscriptions = creatorIds.length > 0 ? await db
    .select({ creatorId: subscriptions.creatorId })
    .from(subscriptions)
    .where(and(
      eq(subscriptions.subscriberId, userId),
      eq(subscriptions.status, 'active'),
      inArray(subscriptions.creatorId, creatorIds)
    )) : [];

  const subscribedCreatorIds = new Set(activeSubscriptions.map(s => s.creatorId));

  // Group purchases by content ID
  const purchasesByContent = new Map<string, Set<number | null>>();
  for (const p of userPurchases) {
    if (!purchasesByContent.has(p.contentId)) {
      purchasesByContent.set(p.contentId, new Set());
    }
    purchasesByContent.get(p.contentId)!.add(p.mediaIndex);
  }

  const processedBookmarks = bookmarkList.map(b => {
    const isSubscribed = subscribedCreatorIds.has(b.creatorId);
    const contentPurchaseSet = purchasesByContent.get(b.contentId) || new Set();
    const hasContentPurchase = contentPurchaseSet.has(null); // null = full content purchase

    // Determine hasAccess based on visibility
    let hasAccess = false;
    if (b.contentVisibility === 'public') {
      hasAccess = true;
    } else if (b.contentVisibility === 'subscribers') {
      hasAccess = isSubscribed;
    } else if (b.contentVisibility === 'ppv') {
      hasAccess = hasContentPurchase;
    }

    // Process media with per-item access
    const media = (b.contentMedia as MediaItem[] || []).map((m, idx) => {
      let mediaHasAccess = hasAccess;

      // Check per-media PPV
      if (m.ppvPrice && m.ppvPrice > 0) {
        // Per-media PPV - need specific purchase
        mediaHasAccess = contentPurchaseSet.has(idx) || hasContentPurchase;
      }

      return {
        ...m,
        hasAccess: mediaHasAccess,
      };
    });

    return {
      id: b.id,
      bookmarkedAt: b.createdAt,
      content: {
        id: b.contentId,
        type: b.contentType,
        visibility: b.contentVisibility,
        ppvPrice: b.contentPpvPrice,
        text: b.contentText,
        media,
        viewCount: b.viewCount,
        likeCount: b.likeCount,
        commentCount: b.commentCount,
        createdAt: b.contentCreatedAt,
        publishedAt: b.publishedAt,
        hasBookmarked: true,
        hasAccess,
        creator: {
          id: b.creatorId,
          displayName: b.creatorDisplayName,
          username: b.creatorUsername,
          avatarUrl: b.creatorAvatarUrl,
          isPro: b.creatorIsPro,
          isVerified: b.creatorVerified,
        },
      },
    };
  });

  return {
    data: processedBookmarks,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}
