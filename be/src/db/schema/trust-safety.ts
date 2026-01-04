import { pgTable, uuid, varchar, text, timestamp, boolean, integer, pgEnum, index, jsonb, date } from 'drizzle-orm/pg-core';
import { users } from './users';
import { creators } from './creators';
import { contents } from './content';
import { messages } from './social';

// ==================== KYC VERIFICATION ====================

export const kycStatusEnum = pgEnum('kyc_status', [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'expired'
]);

export const documentTypeEnum = pgEnum('document_type', [
  'rg',
  'cnh',
  'passport'
]);

export const kycVerifications = pgTable('kyc_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  // Document info
  documentType: documentTypeEnum('document_type').notNull(),
  documentNumber: varchar('document_number', { length: 50 }),
  documentFrontUrl: text('document_front_url').notNull(),
  documentBackUrl: text('document_back_url'),
  selfieUrl: text('selfie_url').notNull(),

  // Personal info
  fullName: varchar('full_name', { length: 255 }),
  birthDate: date('birth_date'),

  // Status
  status: kycStatusEnum('status').default('pending').notNull(),

  // Admin review
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),

  // Metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('kyc_verifications_creator_id_idx').on(table.creatorId),
  index('kyc_verifications_status_idx').on(table.status),
  index('kyc_verifications_created_at_idx').on(table.createdAt),
]);

// ==================== REPORTS ====================

export const reportTypeEnum = pgEnum('report_type', [
  'content',
  'creator',
  'message',
  'user'
]);

export const reportReasonEnum = pgEnum('report_reason', [
  'illegal_content',
  'underage',
  'harassment',
  'spam',
  'copyright',
  'impersonation',
  'fraud',
  'other'
]);

export const reportStatusEnum = pgEnum('report_status', [
  'pending',
  'under_review',
  'resolved',
  'dismissed'
]);

export const reportActionEnum = pgEnum('report_action', [
  'dismissed',
  'warning_issued',
  'content_removed',
  'creator_suspended',
  'user_banned'
]);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Reporter
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // What's being reported
  reportType: reportTypeEnum('report_type').notNull(),
  targetContentId: uuid('target_content_id').references(() => contents.id, { onDelete: 'set null' }),
  targetCreatorId: uuid('target_creator_id').references(() => creators.id, { onDelete: 'set null' }),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
  targetMessageId: uuid('target_message_id').references(() => messages.id, { onDelete: 'set null' }),

  // Report details
  reason: reportReasonEnum('reason').notNull(),
  description: text('description'),
  evidenceUrls: jsonb('evidence_urls').$type<string[]>().default([]),

  // Status
  status: reportStatusEnum('status').default('pending').notNull(),
  priority: integer('priority').default(0).notNull(),

  // Admin resolution
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  action: reportActionEnum('action'),
  actionNote: text('action_note'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('reports_reporter_id_idx').on(table.reporterId),
  index('reports_status_idx').on(table.status),
  index('reports_report_type_idx').on(table.reportType),
  index('reports_target_creator_id_idx').on(table.targetCreatorId),
  index('reports_target_content_id_idx').on(table.targetContentId),
  index('reports_created_at_idx').on(table.createdAt),
  index('reports_priority_idx').on(table.priority),
]);

// Reporter credibility tracking
export const reporterCredibility = pgTable('reporter_credibility', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),

  totalReports: integer('total_reports').default(0).notNull(),
  validReports: integer('valid_reports').default(0).notNull(),
  falseReports: integer('false_reports').default(0).notNull(),

  // Credibility score (0-100)
  score: integer('score').default(50).notNull(),

  isTrusted: boolean('is_trusted').default(false).notNull(),
  isFlagged: boolean('is_flagged').default(false).notNull(),

  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('reporter_credibility_user_id_idx').on(table.userId),
  index('reporter_credibility_score_idx').on(table.score),
]);

// ==================== ACCOUNT SECURITY ====================

export const suspensionTypeEnum = pgEnum('suspension_type', [
  'temporary',
  'permanent'
]);

export const accountSuspensions = pgTable('account_suspensions', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  type: suspensionTypeEnum('type').notNull(),
  reason: text('reason').notNull(),

  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),

  startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow().notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),

  suspendedBy: uuid('suspended_by').notNull().references(() => users.id, { onDelete: 'set null' }),

  isActive: boolean('is_active').default(true).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by').references(() => users.id, { onDelete: 'set null' }),
  revocationReason: text('revocation_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('account_suspensions_user_id_idx').on(table.userId),
  index('account_suspensions_is_active_idx').on(table.isActive),
  index('account_suspensions_ends_at_idx').on(table.endsAt),
]);

// ==================== AUDIT LOG ====================

export const auditActionTypeEnum = pgEnum('audit_action_type', [
  'kyc_approved',
  'kyc_rejected',
  'report_reviewed',
  'report_dismissed',
  'account_suspended',
  'account_unsuspended',
  'account_banned',
  'content_removed',
  'content_restored',
  'payout_blocked',
  'payout_unblocked',
  'admin_note_added'
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  adminId: uuid('admin_id').notNull().references(() => users.id, { onDelete: 'set null' }),

  action: auditActionTypeEnum('action').notNull(),

  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: uuid('target_id').notNull(),

  details: jsonb('details').$type<Record<string, unknown>>().default({}),
  ipAddress: varchar('ip_address', { length: 45 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_logs_admin_id_idx').on(table.adminId),
  index('audit_logs_target_type_idx').on(table.targetType),
  index('audit_logs_target_id_idx').on(table.targetId),
  index('audit_logs_action_idx').on(table.action),
  index('audit_logs_created_at_idx').on(table.createdAt),
]);

// ==================== FRAUD DETECTION ====================

export const fraudFlagTypeEnum = pgEnum('fraud_flag_type', [
  'duplicate_cpf',
  'velocity_payment',
  'velocity_payout',
  'suspicious_pattern',
  'chargeback',
  'device_fingerprint'
]);

export const fraudFlags = pgTable('fraud_flags', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'cascade' }),

  type: fraudFlagTypeEnum('type').notNull(),
  severity: integer('severity').default(1).notNull(),

  description: text('description').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

  isResolved: boolean('is_resolved').default(false).notNull(),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolution: text('resolution'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('fraud_flags_user_id_idx').on(table.userId),
  index('fraud_flags_creator_id_idx').on(table.creatorId),
  index('fraud_flags_type_idx').on(table.type),
  index('fraud_flags_is_resolved_idx').on(table.isResolved),
  index('fraud_flags_severity_idx').on(table.severity),
]);

// Device fingerprints
export const deviceFingerprints = pgTable('device_fingerprints', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),

  userAgent: text('user_agent'),
  screenResolution: varchar('screen_resolution', { length: 20 }),
  timezone: varchar('timezone', { length: 100 }),
  language: varchar('language', { length: 10 }),

  ipAddress: varchar('ip_address', { length: 45 }),

  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),

  isTrusted: boolean('is_trusted').default(false).notNull(),
}, (table) => [
  index('device_fingerprints_user_id_idx').on(table.userId),
  index('device_fingerprints_fingerprint_idx').on(table.fingerprint),
]);

// Chargeback tracking
export const chargebacks = pgTable('chargebacks', {
  id: uuid('id').primaryKey().defaultRandom(),

  paymentId: uuid('payment_id').notNull(),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),

  amount: integer('amount').notNull(),

  asaasChargebackId: varchar('asaas_chargeback_id', { length: 50 }),

  status: varchar('status', { length: 20 }).default('pending').notNull(),

  penaltyAmount: integer('penalty_amount').default(0).notNull(),
  penaltyApplied: boolean('penalty_applied').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('chargebacks_payment_id_idx').on(table.paymentId),
  index('chargebacks_creator_id_idx').on(table.creatorId),
  index('chargebacks_status_idx').on(table.status),
]);

// Types
export type KycVerification = typeof kycVerifications.$inferSelect;
export type NewKycVerification = typeof kycVerifications.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ReporterCredibility = typeof reporterCredibility.$inferSelect;
export type AccountSuspension = typeof accountSuspensions.$inferSelect;
export type NewAccountSuspension = typeof accountSuspensions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type FraudFlag = typeof fraudFlags.$inferSelect;
export type NewFraudFlag = typeof fraudFlags.$inferInsert;
export type DeviceFingerprint = typeof deviceFingerprints.$inferSelect;
export type Chargeback = typeof chargebacks.$inferSelect;
