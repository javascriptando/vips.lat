import { db } from '@/db';
import { stories, storyViews, creators, users, favorites, subscriptions } from '@/db/schema';
import { eq, and, gt, lt, desc, sql, inArray } from 'drizzle-orm';

const STORY_DURATION_HOURS = 24;

export async function createStory(
  creatorId: string,
  data: {
    mediaUrl: string;
    mediaType: 'image' | 'video';
    thumbnailUrl?: string;
    text?: string;
  }
) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + STORY_DURATION_HOURS);

  const [story] = await db.insert(stories).values({
    creatorId,
    mediaUrl: data.mediaUrl,
    mediaType: data.mediaType,
    thumbnailUrl: data.thumbnailUrl,
    text: data.text,
    expiresAt,
  }).returning();

  return story;
}

export async function getActiveStoriesByCreator(creatorId: string) {
  const now = new Date();

  return db.query.stories.findMany({
    where: and(
      eq(stories.creatorId, creatorId),
      gt(stories.expiresAt, now)
    ),
    orderBy: [desc(stories.createdAt)],
  });
}

export async function getStoriesFromFollowedCreators(userId: string) {
  const now = new Date();

  // Get creators the user follows (favorites)
  const followedCreators = await db
    .select({ creatorId: favorites.creatorId })
    .from(favorites)
    .where(eq(favorites.userId, userId));

  // Get creators the user subscribes to
  const subscribedCreators = await db
    .select({ creatorId: subscriptions.creatorId })
    .from(subscriptions)
    .where(and(eq(subscriptions.subscriberId, userId), eq(subscriptions.status, 'active')));

  // Combine followed and subscribed creators (without duplicates)
  const creatorIdSet = new Set<string>();
  followedCreators.forEach(f => creatorIdSet.add(f.creatorId));
  subscribedCreators.forEach(s => creatorIdSet.add(s.creatorId));

  const creatorIds = Array.from(creatorIdSet);

  if (creatorIds.length === 0) {
    return [];
  }

  // Get active stories from followed creators with creator info
  const storiesWithCreators = await db
    .select({
      id: stories.id,
      mediaUrl: stories.mediaUrl,
      mediaType: stories.mediaType,
      thumbnailUrl: stories.thumbnailUrl,
      text: stories.text,
      viewCount: stories.viewCount,
      expiresAt: stories.expiresAt,
      createdAt: stories.createdAt,
      creatorId: creators.id,
      displayName: creators.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl,
      isVerified: creators.verified,
    })
    .from(stories)
    .innerJoin(creators, eq(creators.id, stories.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(and(
      inArray(stories.creatorId, creatorIds),
      gt(stories.expiresAt, now)
    ))
    .orderBy(desc(stories.createdAt));

  // Check which stories the user has viewed
  const storyIds = storiesWithCreators.map(s => s.id);

  let viewedStoryIds: string[] = [];
  if (storyIds.length > 0) {
    const views = await db
      .select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(and(
        eq(storyViews.userId, userId),
        inArray(storyViews.storyId, storyIds)
      ));
    viewedStoryIds = views.map(v => v.storyId);
  }

  // Group stories by creator
  const creatorsMap = new Map<string, {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    isVerified: boolean;
    stories: Array<{
      id: string;
      mediaUrl: string;
      mediaType: string;
      thumbnailUrl: string | null;
      text: string | null;
      viewCount: number;
      expiresAt: Date;
      createdAt: Date;
      isViewed: boolean;
    }>;
    hasUnviewed: boolean;
  }>();

  for (const story of storiesWithCreators) {
    const isViewed = viewedStoryIds.includes(story.id);

    if (!creatorsMap.has(story.creatorId)) {
      creatorsMap.set(story.creatorId, {
        id: story.creatorId,
        displayName: story.displayName,
        username: story.username || '',
        avatarUrl: story.avatarUrl,
        isVerified: story.isVerified,
        stories: [],
        hasUnviewed: false,
      });
    }

    const creator = creatorsMap.get(story.creatorId)!;
    creator.stories.push({
      id: story.id,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      thumbnailUrl: story.thumbnailUrl,
      text: story.text,
      viewCount: story.viewCount,
      expiresAt: story.expiresAt,
      createdAt: story.createdAt,
      isViewed,
    });

    if (!isViewed) {
      creator.hasUnviewed = true;
    }
  }

  // Sort creators: unviewed first, then by most recent story
  return Array.from(creatorsMap.values()).sort((a, b) => {
    if (a.hasUnviewed !== b.hasUnviewed) {
      return a.hasUnviewed ? -1 : 1;
    }
    const aLatest = a.stories[0]?.createdAt.getTime() || 0;
    const bLatest = b.stories[0]?.createdAt.getTime() || 0;
    return bLatest - aLatest;
  });
}

export async function markStoryAsViewed(storyId: string, userId: string) {
  // Check if already viewed
  const existing = await db.query.storyViews.findFirst({
    where: and(
      eq(storyViews.storyId, storyId),
      eq(storyViews.userId, userId)
    ),
  });

  if (existing) {
    return { alreadyViewed: true };
  }

  // Mark as viewed
  await db.insert(storyViews).values({ storyId, userId });

  // Increment view count
  await db.update(stories)
    .set({ viewCount: sql`${stories.viewCount} + 1` })
    .where(eq(stories.id, storyId));

  return { alreadyViewed: false };
}

export async function deleteStory(storyId: string, creatorId: string) {
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) {
    throw new Error('Story not found');
  }

  if (story.creatorId !== creatorId) {
    throw new Error('Unauthorized');
  }

  await db.delete(stories).where(eq(stories.id, storyId));
  return { deleted: true };
}

export async function getStoryById(storyId: string) {
  return db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });
}

export async function getStoryViewers(storyId: string, creatorId: string, page = 1, pageSize = 20) {
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story || story.creatorId !== creatorId) {
    throw new Error('Unauthorized');
  }

  const offset = (page - 1) * pageSize;

  const viewers = await db
    .select({
      id: storyViews.id,
      viewedAt: storyViews.viewedAt,
      userId: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(storyViews)
    .innerJoin(users, eq(users.id, storyViews.userId))
    .where(eq(storyViews.storyId, storyId))
    .orderBy(desc(storyViews.viewedAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(storyViews)
    .where(eq(storyViews.storyId, storyId));

  return {
    data: viewers,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

// Cleanup expired stories (to be run periodically)
export async function cleanupExpiredStories() {
  const now = new Date();

  const result = await db.delete(stories)
    .where(lt(stories.expiresAt, now))
    .returning({ id: stories.id });

  return { deletedCount: result.length };
}
