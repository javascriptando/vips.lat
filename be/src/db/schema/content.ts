import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum, index, jsonb } from 'drizzle-orm/pg-core';
import { creators } from './creators';
import { users } from './users';

export const contentTypeEnum = pgEnum('content_type', ['post', 'image', 'video']);
export const contentVisibilityEnum = pgEnum('content_visibility', ['public', 'subscribers', 'ppv']);

export const contents = pgTable('contents', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  type: contentTypeEnum('type').notNull(),
  visibility: contentVisibilityEnum('visibility').default('subscribers').notNull(),

  // Content
  text: text('text'),

  // Media - array de objetos com path, url, type, size
  media: jsonb('media').$type<MediaItem[]>().default([]),

  // PPV (null se não for PPV)
  ppvPrice: integer('ppv_price'), // centavos

  // Stats
  viewCount: integer('view_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),

  // Status
  isPublished: boolean('is_published').default(true).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('contents_creator_id_idx').on(table.creatorId),
  index('contents_visibility_idx').on(table.visibility),
  index('contents_is_published_idx').on(table.isPublished),
  index('contents_published_at_idx').on(table.publishedAt),
]);

// Likes
export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentId: uuid('content_id').notNull().references(() => contents.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('likes_user_id_idx').on(table.userId),
  index('likes_content_id_idx').on(table.contentId),
]);

// Compras de PPV
export const contentPurchases = pgTable('content_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentId: uuid('content_id').notNull().references(() => contents.id, { onDelete: 'cascade' }),
  pricePaid: integer('price_paid').notNull(), // centavos
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('content_purchases_user_id_idx').on(table.userId),
  index('content_purchases_content_id_idx').on(table.contentId),
]);

// Stories (temporary content that expires after 24h)
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  // Media (single image or video)
  mediaUrl: text('media_url').notNull(),
  mediaType: text('media_type').notNull().$type<'image' | 'video'>(),
  thumbnailUrl: text('thumbnail_url'),

  // Optional text overlay
  text: text('text'),

  // Stats
  viewCount: integer('view_count').default(0).notNull(),

  // Expiry (24h from creation)
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('stories_creator_id_idx').on(table.creatorId),
  index('stories_expires_at_idx').on(table.expiresAt),
]);

// Story views (to track who watched)
export const storyViews = pgTable('story_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('story_views_story_id_idx').on(table.storyId),
  index('story_views_user_id_idx').on(table.userId),
]);

// Types
export interface MediaItem {
  path: string;
  url: string;
  type: 'image' | 'video';
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  // Per-media PPV (optional - if set, this specific media is locked)
  ppvPrice?: number; // centavos - se definido, esta mídia específica é paga
  order?: number; // ordem no carrossel
  duration?: number; // duração em segundos (para vídeos)
}

export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
export type Like = typeof likes.$inferSelect;
export type ContentPurchase = typeof contentPurchases.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryView = typeof storyViews.$inferSelect;
