import { db } from '@/db';
import { favorites, bookmarks, creators, contents, users } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

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
      contentText: contents.text,
      contentMedia: contents.media,
      viewCount: contents.viewCount,
      likeCount: contents.likeCount,
      publishedAt: contents.publishedAt,
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

  const processedBookmarks = bookmarkList.map(b => ({
    id: b.id,
    bookmarkedAt: b.createdAt,
    content: {
      id: b.contentId,
      type: b.contentType,
      visibility: b.contentVisibility,
      text: b.contentText,
      media: b.contentMedia,
      viewCount: b.viewCount,
      likeCount: b.likeCount,
      publishedAt: b.publishedAt,
      creator: {
        id: b.creatorId,
        displayName: b.creatorDisplayName,
        username: b.creatorUsername,
        avatarUrl: b.creatorAvatarUrl,
        isPro: b.creatorIsPro,
        verified: b.creatorVerified,
      },
    },
  }));

  return {
    data: processedBookmarks,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}
