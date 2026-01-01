import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { creators } from './creators';
import { contents } from './content';

// Enums
export const notificationTypeEnum = pgEnum('notification_type', [
  'new_subscriber',
  'new_like',
  'new_comment',
  'new_tip',
  'new_content',
  'payment_received',
  'subscription_expiring',
  'subscription_expired',
  'payout_completed',
  'system',
]);

// Notificações
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),

  // Referências opcionais
  fromUserId: uuid('from_user_id').references(() => users.id, { onDelete: 'set null' }),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'set null' }),
  creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'set null' }),

  // Metadados extras (JSON)
  metadata: text('metadata'),

  // Status
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notifications_user_id_idx').on(table.userId),
  index('notifications_is_read_idx').on(table.isRead),
  index('notifications_created_at_idx').on(table.createdAt),
]);

// Comentários
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull().references(() => contents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  text: text('text').notNull(),

  // Resposta a outro comentário
  parentId: uuid('parent_id'),

  // Stats
  likeCount: integer('like_count').default(0).notNull(),

  // Status
  isDeleted: boolean('is_deleted').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('comments_content_id_idx').on(table.contentId),
  index('comments_user_id_idx').on(table.userId),
  index('comments_parent_id_idx').on(table.parentId),
]);

// Likes de comentários
export const commentLikes = pgTable('comment_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('comment_likes_comment_id_idx').on(table.commentId),
  index('comment_likes_user_id_idx').on(table.userId),
]);

// Favoritos (bookmarks de criadores)
export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('favorites_user_id_idx').on(table.userId),
  index('favorites_creator_id_idx').on(table.creatorId),
]);

// Bookmarks de conteúdo
export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentId: uuid('content_id').notNull().references(() => contents.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('bookmarks_user_id_idx').on(table.userId),
  index('bookmarks_content_id_idx').on(table.contentId),
]);

// Conversas (threads de mensagens entre usuário e criador)
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Participantes
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  // Última mensagem
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).defaultNow().notNull(),
  lastMessagePreview: text('last_message_preview'),

  // Contadores de não lidas
  unreadByUser: integer('unread_by_user').default(0).notNull(),
  unreadByCreator: integer('unread_by_creator').default(0).notNull(),

  // Status
  isBlockedByCreator: boolean('is_blocked_by_creator').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('conversations_user_id_idx').on(table.userId),
  index('conversations_creator_id_idx').on(table.creatorId),
  index('conversations_last_message_at_idx').on(table.lastMessageAt),
]);

// Mensagens
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),

  // Quem enviou (userId do remetente)
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Conteúdo
  text: text('text'),

  // Mídia opcional (imagem, vídeo)
  mediaUrl: text('media_url'),
  mediaType: text('media_type'), // 'image' | 'video'
  thumbnailUrl: text('thumbnail_url'), // thumbnail para vídeos

  // PPV media in message (creator sends paid content)
  ppvPrice: integer('ppv_price'), // centavos - se definido, mídia é paga
  isPurchased: boolean('is_purchased').default(false).notNull(), // se o destinatário comprou

  // Pack attachment (attach existing pack to message)
  packId: uuid('pack_id'), // referência a media_packs (sem FK para evitar dependência circular)

  // Status
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('messages_conversation_id_idx').on(table.conversationId),
  index('messages_sender_id_idx').on(table.senderId),
  index('messages_created_at_idx').on(table.createdAt),
]);

// Types
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type CommentLike = typeof commentLikes.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
