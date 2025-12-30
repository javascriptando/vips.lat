import { pgTable, uuid, varchar, timestamp, integer, pgEnum, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { creators } from './creators';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'cancelled',
  'expired'
]);

// Duração da assinatura em meses
export const subscriptionDurationEnum = pgEnum('subscription_duration', [
  '1',  // 1 mês
  '3',  // 3 meses
  '6',  // 6 meses
  '12'  // 1 ano
]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriberId: uuid('subscriber_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  status: subscriptionStatusEnum('status').default('active').notNull(),
  duration: subscriptionDurationEnum('duration').default('1').notNull(), // duração em meses
  priceAtPurchase: integer('price_at_purchase').notNull(), // centavos

  // Asaas
  asaasPaymentId: varchar('asaas_payment_id', { length: 50 }),

  // Dates
  startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('subscriptions_subscriber_id_idx').on(table.subscriberId),
  index('subscriptions_creator_id_idx').on(table.creatorId),
  index('subscriptions_status_idx').on(table.status),
  index('subscriptions_expires_at_idx').on(table.expiresAt),
  // Um usuário só pode ter uma assinatura ativa por criador
  unique('subscriptions_subscriber_creator_unique').on(table.subscriberId, table.creatorId),
]);

// Multiplicadores de preço por duração (desconto para planos maiores)
export const SUBSCRIPTION_MULTIPLIERS = {
  '1': 1,      // 1 mês = preço cheio
  '3': 2.7,    // 3 meses = 10% desconto
  '6': 5.1,    // 6 meses = 15% desconto
  '12': 9.6,   // 12 meses = 20% desconto
} as const;

export type SubscriptionDuration = '1' | '3' | '6' | '12';

// Types
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
