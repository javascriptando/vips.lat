import { db } from '@/db';
import { contentViews, profileViews, dailyStats, contents, creators, likes, comments, subscriptions } from '@/db/schema';
import { eq, sql, and, gte, lte, desc, count, countDistinct, inArray } from 'drizzle-orm';
import crypto from 'crypto';

// Gera fingerprint a partir de IP e User-Agent
export function generateFingerprint(ip: string, userAgent: string): string {
  return crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').slice(0, 64);
}

// Registra visualização de conteúdo
export async function trackContentView(
  contentId: string,
  creatorId: string,
  viewerId?: string,
  fingerprint?: string,
  metadata?: { userAgent?: string; referer?: string; country?: string }
) {
  await db.insert(contentViews).values({
    contentId,
    creatorId,
    viewerId,
    fingerprint,
    userAgent: metadata?.userAgent,
    referer: metadata?.referer,
    country: metadata?.country,
  });

  // Também incrementa o contador denormalizado
  await db.update(contents).set({ viewCount: sql`${contents.viewCount} + 1` }).where(eq(contents.id, contentId));
}

// Registra visualização de perfil
export async function trackProfileView(
  creatorId: string,
  viewerId?: string,
  fingerprint?: string,
  metadata?: { userAgent?: string; referer?: string; country?: string }
) {
  await db.insert(profileViews).values({
    creatorId,
    viewerId,
    fingerprint,
    userAgent: metadata?.userAgent,
    referer: metadata?.referer,
    country: metadata?.country,
  });
}

// ===== ANALYTICS BÁSICO (todos os criadores) =====

export interface BasicAnalytics {
  overview: {
    totalViews: number;
    totalLikes: number;
    totalSubscribers: number;
    totalPosts: number;
    totalEarnings: number;
  };
  recentActivity: {
    viewsToday: number;
    viewsThisWeek: number;
    likesToday: number;
    likesThisWeek: number;
  };
  topContent: Array<{
    id: string;
    text: string | null;
    viewCount: number;
    likeCount: number;
    publishedAt: Date | null;
  }>;
}

export async function getBasicAnalytics(creatorId: string): Promise<BasicAnalytics> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  // Overview
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });

  // Views today/week
  const [viewsToday] = await db
    .select({ count: count() })
    .from(contentViews)
    .where(and(eq(contentViews.creatorId, creatorId), gte(contentViews.createdAt, todayStart)));

  const [viewsWeek] = await db
    .select({ count: count() })
    .from(contentViews)
    .where(and(eq(contentViews.creatorId, creatorId), gte(contentViews.createdAt, weekStart)));

  // Likes today/week
  const creatorContents = await db.select({ id: contents.id }).from(contents).where(eq(contents.creatorId, creatorId));
  const contentIds = creatorContents.map(c => c.id);

  let likesToday = 0;
  let likesWeek = 0;

  if (contentIds.length > 0) {
    const [likesTodayResult] = await db
      .select({ count: count() })
      .from(likes)
      .where(and(
        inArray(likes.contentId, contentIds),
        gte(likes.createdAt, todayStart)
      ));
    likesToday = likesTodayResult?.count || 0;

    const [likesWeekResult] = await db
      .select({ count: count() })
      .from(likes)
      .where(and(
        inArray(likes.contentId, contentIds),
        gte(likes.createdAt, weekStart)
      ));
    likesWeek = likesWeekResult?.count || 0;
  }

  // Top content
  const topContent = await db
    .select({
      id: contents.id,
      text: contents.text,
      viewCount: contents.viewCount,
      likeCount: contents.likeCount,
      publishedAt: contents.publishedAt,
    })
    .from(contents)
    .where(eq(contents.creatorId, creatorId))
    .orderBy(desc(contents.viewCount))
    .limit(5);

  // Total views from denormalized field
  const [totalViews] = await db
    .select({ total: sql<number>`COALESCE(SUM(${contents.viewCount}), 0)::int` })
    .from(contents)
    .where(eq(contents.creatorId, creatorId));

  const [totalLikes] = await db
    .select({ total: sql<number>`COALESCE(SUM(${contents.likeCount}), 0)::int` })
    .from(contents)
    .where(eq(contents.creatorId, creatorId));

  return {
    overview: {
      totalViews: totalViews?.total || 0,
      totalLikes: totalLikes?.total || 0,
      totalSubscribers: creator?.subscriberCount || 0,
      totalPosts: creator?.postCount || 0,
      totalEarnings: creator?.totalEarnings || 0,
    },
    recentActivity: {
      viewsToday: viewsToday?.count || 0,
      viewsThisWeek: viewsWeek?.count || 0,
      likesToday,
      likesThisWeek: likesWeek,
    },
    topContent,
  };
}

// ===== ANALYTICS PRO (apenas criadores PRO) =====

export interface ProAnalytics extends BasicAnalytics {
  // Histórico detalhado
  viewsHistory: Array<{ date: string; views: number; uniqueViews: number }>;
  likesHistory: Array<{ date: string; likes: number }>;
  subscribersHistory: Array<{ date: string; newSubscribers: number; unsubscribes: number; total: number }>;
  earningsHistory: Array<{ date: string; earnings: number }>;

  // Métricas avançadas
  engagementRate: number;
  averageViewsPerPost: number;
  averageLikesPerPost: number;

  // Audience insights
  audienceInsights: {
    uniqueViewers: number;
    returningViewers: number;
    topCountries: Array<{ country: string; views: number }>;
  };

  // Content performance
  contentPerformance: Array<{
    id: string;
    text: string | null;
    type: string;
    visibility: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    engagementRate: number;
    publishedAt: Date | null;
  }>;

  // Profile views
  profileViewsHistory: Array<{ date: string; views: number }>;
  totalProfileViews: number;
}

export async function getProAnalytics(creatorId: string, days = 30): Promise<ProAnalytics> {
  const basicAnalytics = await getBasicAnalytics(creatorId);

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  // Views history (grouped by day)
  const viewsHistory = await db
    .select({
      date: sql<string>`DATE(${contentViews.createdAt})::text`,
      views: count(),
      uniqueViews: countDistinct(sql`COALESCE(${contentViews.viewerId}::text, ${contentViews.fingerprint})`),
    })
    .from(contentViews)
    .where(and(eq(contentViews.creatorId, creatorId), gte(contentViews.createdAt, startDate)))
    .groupBy(sql`DATE(${contentViews.createdAt})`)
    .orderBy(sql`DATE(${contentViews.createdAt})`);

  // Likes history
  const creatorContents = await db.select({ id: contents.id }).from(contents).where(eq(contents.creatorId, creatorId));
  const contentIds = creatorContents.map(c => c.id);

  let likesHistory: Array<{ date: string; likes: number }> = [];
  if (contentIds.length > 0) {
    likesHistory = await db
      .select({
        date: sql<string>`DATE(${likes.createdAt})::text`,
        likes: count(),
      })
      .from(likes)
      .where(and(
        inArray(likes.contentId, contentIds),
        gte(likes.createdAt, startDate)
      ))
      .groupBy(sql`DATE(${likes.createdAt})`)
      .orderBy(sql`DATE(${likes.createdAt})`);
  }

  // Subscribers history
  const subscribersHistory = await db
    .select({
      date: sql<string>`DATE(${subscriptions.createdAt})::text`,
      newSubscribers: count(),
    })
    .from(subscriptions)
    .where(and(eq(subscriptions.creatorId, creatorId), gte(subscriptions.createdAt, startDate)))
    .groupBy(sql`DATE(${subscriptions.createdAt})`)
    .orderBy(sql`DATE(${subscriptions.createdAt})`);

  // Profile views history
  const profileViewsHistory = await db
    .select({
      date: sql<string>`DATE(${profileViews.createdAt})::text`,
      views: count(),
    })
    .from(profileViews)
    .where(and(eq(profileViews.creatorId, creatorId), gte(profileViews.createdAt, startDate)))
    .groupBy(sql`DATE(${profileViews.createdAt})`)
    .orderBy(sql`DATE(${profileViews.createdAt})`);

  // Total profile views
  const [totalProfileViews] = await db
    .select({ count: count() })
    .from(profileViews)
    .where(eq(profileViews.creatorId, creatorId));

  // Audience insights
  const [uniqueViewers] = await db
    .select({ count: countDistinct(sql`COALESCE(${contentViews.viewerId}::text, ${contentViews.fingerprint})`) })
    .from(contentViews)
    .where(eq(contentViews.creatorId, creatorId));

  // Viewers who viewed more than once
  const returningViewersResult = await db
    .select({
      viewer: sql`COALESCE(${contentViews.viewerId}::text, ${contentViews.fingerprint})`,
      viewCount: count(),
    })
    .from(contentViews)
    .where(eq(contentViews.creatorId, creatorId))
    .groupBy(sql`COALESCE(${contentViews.viewerId}::text, ${contentViews.fingerprint})`)
    .having(sql`COUNT(*) > 1`);

  // Top countries
  const topCountries = await db
    .select({
      country: contentViews.country,
      views: count(),
    })
    .from(contentViews)
    .where(and(eq(contentViews.creatorId, creatorId), sql`${contentViews.country} IS NOT NULL`))
    .groupBy(contentViews.country)
    .orderBy(desc(count()))
    .limit(10);

  // Content performance with comments count
  const contentPerformance = await Promise.all(
    creatorContents.slice(0, 20).map(async (content) => {
      const contentData = await db.query.contents.findFirst({ where: eq(contents.id, content.id) });
      const [commentCount] = await db
        .select({ count: count() })
        .from(comments)
        .where(eq(comments.contentId, content.id));

      const views = contentData?.viewCount || 0;
      const likesCount = contentData?.likeCount || 0;
      const commentsCount = commentCount?.count || 0;
      const engagementRate = views > 0 ? ((likesCount + commentsCount) / views) * 100 : 0;

      return {
        id: content.id,
        text: contentData?.text || null,
        type: contentData?.type || 'post',
        visibility: contentData?.visibility || 'public',
        viewCount: views,
        likeCount: likesCount,
        commentCount: commentsCount,
        engagementRate: Math.round(engagementRate * 100) / 100,
        publishedAt: contentData?.publishedAt || null,
      };
    })
  );

  // Sort by views
  contentPerformance.sort((a, b) => b.viewCount - a.viewCount);

  // Calculate averages
  const totalPosts = basicAnalytics.overview.totalPosts || 1;
  const averageViewsPerPost = Math.round(basicAnalytics.overview.totalViews / totalPosts);
  const averageLikesPerPost = Math.round(basicAnalytics.overview.totalLikes / totalPosts);
  const engagementRate = basicAnalytics.overview.totalViews > 0
    ? (basicAnalytics.overview.totalLikes / basicAnalytics.overview.totalViews) * 100
    : 0;

  return {
    ...basicAnalytics,
    viewsHistory: viewsHistory.map(v => ({ date: v.date, views: v.views, uniqueViews: v.uniqueViews })),
    likesHistory: likesHistory.map(l => ({ date: l.date, likes: l.likes })),
    subscribersHistory: subscribersHistory.map((s, i, arr) => ({
      date: s.date,
      newSubscribers: s.newSubscribers,
      unsubscribes: 0, // Would need to track unsubscribes separately
      total: arr.slice(0, i + 1).reduce((sum, item) => sum + item.newSubscribers, basicAnalytics.overview.totalSubscribers - arr.reduce((sum, item) => sum + item.newSubscribers, 0)),
    })),
    earningsHistory: [], // Would need to join with payments table
    engagementRate: Math.round(engagementRate * 100) / 100,
    averageViewsPerPost,
    averageLikesPerPost,
    audienceInsights: {
      uniqueViewers: uniqueViewers?.count || 0,
      returningViewers: returningViewersResult.length,
      topCountries: topCountries.map(c => ({ country: c.country || 'Unknown', views: c.views })),
    },
    contentPerformance,
    profileViewsHistory: profileViewsHistory.map(p => ({ date: p.date, views: p.views })),
    totalProfileViews: totalProfileViews?.count || 0,
  };
}

// ===== DAILY STATS AGGREGATION (for cron job) =====

export async function aggregateDailyStats(creatorId: string, date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Get views for the day
  const [viewsResult] = await db
    .select({
      views: count(),
      uniqueViews: countDistinct(sql`COALESCE(${contentViews.viewerId}::text, ${contentViews.fingerprint})`),
    })
    .from(contentViews)
    .where(and(
      eq(contentViews.creatorId, creatorId),
      gte(contentViews.createdAt, dayStart),
      lte(contentViews.createdAt, dayEnd)
    ));

  // Get profile views
  const [profileViewsResult] = await db
    .select({ count: count() })
    .from(profileViews)
    .where(and(
      eq(profileViews.creatorId, creatorId),
      gte(profileViews.createdAt, dayStart),
      lte(profileViews.createdAt, dayEnd)
    ));

  // Get likes for the day
  const creatorContents = await db.select({ id: contents.id }).from(contents).where(eq(contents.creatorId, creatorId));
  const contentIds = creatorContents.map(c => c.id);

  let likesCount = 0;
  let commentsCount = 0;

  if (contentIds.length > 0) {
    const [likesResult] = await db
      .select({ count: count() })
      .from(likes)
      .where(and(
        inArray(likes.contentId, contentIds),
        gte(likes.createdAt, dayStart),
        lte(likes.createdAt, dayEnd)
      ));
    likesCount = likesResult?.count || 0;

    const [commentsResult] = await db
      .select({ count: count() })
      .from(comments)
      .where(and(
        inArray(comments.contentId, contentIds),
        gte(comments.createdAt, dayStart),
        lte(comments.createdAt, dayEnd)
      ));
    commentsCount = commentsResult?.count || 0;
  }

  // Get new subscribers
  const [newSubsResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(and(
      eq(subscriptions.creatorId, creatorId),
      gte(subscriptions.createdAt, dayStart),
      lte(subscriptions.createdAt, dayEnd)
    ));

  // Get creator current stats
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });

  // Upsert daily stats
  await db
    .insert(dailyStats)
    .values({
      creatorId,
      date: dayStart,
      views: viewsResult?.views || 0,
      uniqueViews: viewsResult?.uniqueViews || 0,
      likes: likesCount,
      comments: commentsCount,
      newSubscribers: newSubsResult?.count || 0,
      unsubscribes: 0,
      earnings: 0, // Would need to calculate from payments
      profileViews: profileViewsResult?.count || 0,
      totalSubscribers: creator?.subscriberCount || 0,
      totalPosts: creator?.postCount || 0,
    })
    .onConflictDoUpdate({
      target: [dailyStats.creatorId, dailyStats.date],
      set: {
        views: viewsResult?.views || 0,
        uniqueViews: viewsResult?.uniqueViews || 0,
        likes: likesCount,
        comments: commentsCount,
        newSubscribers: newSubsResult?.count || 0,
        profileViews: profileViewsResult?.count || 0,
        totalSubscribers: creator?.subscriberCount || 0,
        totalPosts: creator?.postCount || 0,
      },
    });
}
