import { pgTable, uuid, text, timestamp, integer, index, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { creators } from './creators';
import { contents } from './content';

// Views de conteúdo (rastreia cada visualização individual)
export const contentViews = pgTable('content_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull().references(() => contents.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  // Quem visualizou (null = visitante anônimo)
  viewerId: uuid('viewer_id').references(() => users.id, { onDelete: 'set null' }),

  // Fingerprint para visitantes anônimos (hash do IP + user agent)
  fingerprint: varchar('fingerprint', { length: 64 }),

  // Metadados
  userAgent: text('user_agent'),
  referer: text('referer'),
  country: varchar('country', { length: 2 }), // ISO country code

  // Duração da visualização em segundos (se implementado)
  duration: integer('duration'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('content_views_content_id_idx').on(table.contentId),
  index('content_views_creator_id_idx').on(table.creatorId),
  index('content_views_viewer_id_idx').on(table.viewerId),
  index('content_views_created_at_idx').on(table.createdAt),
  index('content_views_fingerprint_idx').on(table.fingerprint),
]);

// Views de perfil do criador
export const profileViews = pgTable('profile_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  // Quem visualizou
  viewerId: uuid('viewer_id').references(() => users.id, { onDelete: 'set null' }),
  fingerprint: varchar('fingerprint', { length: 64 }),

  // Metadados
  userAgent: text('user_agent'),
  referer: text('referer'),
  country: varchar('country', { length: 2 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('profile_views_creator_id_idx').on(table.creatorId),
  index('profile_views_viewer_id_idx').on(table.viewerId),
  index('profile_views_created_at_idx').on(table.createdAt),
]);

// Snapshot diário de métricas (para histórico e gráficos)
export const dailyStats = pgTable('daily_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  // Data do snapshot (sem horário)
  date: timestamp('date', { withTimezone: true }).notNull(),

  // Métricas do dia
  views: integer('views').default(0).notNull(),
  uniqueViews: integer('unique_views').default(0).notNull(),
  likes: integer('likes').default(0).notNull(),
  comments: integer('comments').default(0).notNull(),
  newSubscribers: integer('new_subscribers').default(0).notNull(),
  unsubscribes: integer('unsubscribes').default(0).notNull(),
  earnings: integer('earnings').default(0).notNull(), // centavos
  profileViews: integer('profile_views').default(0).notNull(),

  // Contadores acumulados no final do dia
  totalSubscribers: integer('total_subscribers').default(0).notNull(),
  totalPosts: integer('total_posts').default(0).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('daily_stats_creator_id_idx').on(table.creatorId),
  index('daily_stats_date_idx').on(table.date),
  index('daily_stats_creator_date_idx').on(table.creatorId, table.date),
]);

// Types
export type ContentView = typeof contentViews.$inferSelect;
export type NewContentView = typeof contentViews.$inferInsert;
export type ProfileView = typeof profileViews.$inferSelect;
export type NewProfileView = typeof profileViews.$inferInsert;
export type DailyStat = typeof dailyStats.$inferSelect;
export type NewDailyStat = typeof dailyStats.$inferInsert;
