import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { creators } from './creators';
import { subscriptions } from './subscriptions';
import { contents } from './content';

export const paymentTypeEnum = pgEnum('payment_type', [
  'subscription',
  'ppv',
  'tip',
  'pro_plan',
  'pack'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'confirmed',
  'failed',
  'refunded',
  'expired'
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  payerId: uuid('payer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'set null' }), // null para pro_plan
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'set null' }),

  // Type & Amount (todos em centavos)
  type: paymentTypeEnum('type').notNull(),
  amount: integer('amount').notNull(), // valor base
  pixFee: integer('pix_fee').notNull(), // taxa pix (paga pelo cliente)
  platformFee: integer('platform_fee').notNull(), // fee da plataforma
  creatorAmount: integer('creator_amount').notNull(), // valor líquido criador

  // Asaas
  asaasPaymentId: varchar('asaas_payment_id', { length: 50 }),
  asaasPixQrCode: text('asaas_pix_qr_code'), // payload copia e cola
  asaasPixQrCodeImage: text('asaas_pix_qr_code_image'), // base64 do QR code
  asaasPixExpiresAt: timestamp('asaas_pix_expires_at', { withTimezone: true }),

  // Status
  status: paymentStatusEnum('status').default('pending').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),

  // Metadata
  description: text('description'),
  metadata: jsonb('metadata'), // dados extras como duração da assinatura

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('payments_payer_id_idx').on(table.payerId),
  index('payments_creator_id_idx').on(table.creatorId),
  index('payments_status_idx').on(table.status),
  index('payments_type_idx').on(table.type),
  index('payments_asaas_payment_id_idx').on(table.asaasPaymentId),
  index('payments_created_at_idx').on(table.createdAt),
]);

// Payouts (saques para criadores)
export const payoutStatusEnum = pgEnum('payout_status', [
  'pending',
  'processing',
  'completed',
  'failed'
]);

export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  amount: integer('amount').notNull(), // centavos

  // Asaas
  asaasTransferId: varchar('asaas_transfer_id', { length: 50 }),

  status: payoutStatusEnum('status').default('pending').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  failedReason: text('failed_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('payouts_creator_id_idx').on(table.creatorId),
  index('payouts_status_idx').on(table.status),
  index('payouts_created_at_idx').on(table.createdAt),
]);

// Types
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;
