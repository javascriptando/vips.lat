import { pgTable, uuid, varchar, text, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const creators = pgTable('creators', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),

  // Profile
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'),
  coverUrl: text('cover_url'),

  // Subscription price (em centavos)
  subscriptionPrice: integer('subscription_price').notNull(),

  // Asaas
  asaasAccountId: varchar('asaas_account_id', { length: 50 }),
  asaasPixKey: varchar('asaas_pix_key', { length: 100 }),
  asaasPixKeyType: varchar('asaas_pix_key_type', { length: 10 }), // CPF, CNPJ, EMAIL, PHONE, EVP

  // PRO
  isPro: boolean('is_pro').default(false).notNull(),
  proExpiresAt: timestamp('pro_expires_at', { withTimezone: true }),

  // Stats (denormalized for performance)
  subscriberCount: integer('subscriber_count').default(0).notNull(),
  postCount: integer('post_count').default(0).notNull(),
  totalEarnings: integer('total_earnings').default(0).notNull(), // centavos

  // Verification
  cpfCnpj: varchar('cpf_cnpj', { length: 18 }),
  verified: boolean('verified').default(false).notNull(),

  // Visibility
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('creators_user_id_idx').on(table.userId),
  index('creators_is_active_idx').on(table.isActive),
  index('creators_subscriber_count_idx').on(table.subscriberCount),
]);

// Saldo do criador
export const balances = pgTable('balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }).unique(),

  available: integer('available').default(0).notNull(), // disponível para saque (centavos)
  pending: integer('pending').default(0).notNull(), // aguardando confirmação (centavos)

  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('balances_creator_id_idx').on(table.creatorId),
]);

// Types
export type Creator = typeof creators.$inferSelect;
export type NewCreator = typeof creators.$inferInsert;
export type Balance = typeof balances.$inferSelect;
