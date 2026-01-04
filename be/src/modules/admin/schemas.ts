import { z } from 'zod';

export const suspendUserSchema = z.object({
  reason: z.string().min(5).max(500),
  days: z.number().min(1).max(365).optional(), // undefined = permanent
});

export const unsuspendUserSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const blockPayoutsSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  search: z.string().optional(),
  role: z.enum(['subscriber', 'creator', 'admin', 'all']).default('all'),
  suspended: z.enum(['true', 'false', 'all']).default('all'),
});

export const listCreatorsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  search: z.string().optional(),
  kycStatus: z.enum(['none', 'pending', 'approved', 'rejected', 'all']).default('all'),
  verified: z.enum(['true', 'false', 'all']).default('all'),
  payoutsBlocked: z.enum(['true', 'false', 'all']).default('all'),
});

export const listAuditLogsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  action: z.string().optional(),
  adminId: z.string().uuid().optional(),
  targetType: z.string().optional(),
});

export const listFraudFlagsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  resolved: z.enum(['true', 'false', 'all']).default('false'),
  type: z.string().optional(),
});

export const resolveFraudFlagSchema = z.object({
  resolution: z.string().min(5).max(500),
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
export type UnsuspendUserInput = z.infer<typeof unsuspendUserSchema>;
export type BlockPayoutsInput = z.infer<typeof blockPayoutsSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type ListCreatorsInput = z.infer<typeof listCreatorsSchema>;
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
export type ListFraudFlagsInput = z.infer<typeof listFraudFlagsSchema>;
export type ResolveFraudFlagInput = z.infer<typeof resolveFraudFlagSchema>;
