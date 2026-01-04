import { z } from 'zod';

export const createReportSchema = z.object({
  reportType: z.enum(['content', 'creator', 'message', 'user']),
  targetId: z.string().uuid(),
  reason: z.enum([
    'illegal_content',
    'underage',
    'harassment',
    'spam',
    'copyright',
    'impersonation',
    'fraud',
    'other'
  ]),
  description: z.string().max(2000).optional(),
});

export const reviewReportSchema = z.object({
  action: z.enum([
    'dismissed',
    'warning_issued',
    'content_removed',
    'creator_suspended',
    'user_banned'
  ]),
  actionNote: z.string().max(1000).optional(),
  suspensionDays: z.number().min(1).max(365).optional(),
});

export const listReportsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['pending', 'under_review', 'resolved', 'dismissed', 'all']).default('pending'),
  reportType: z.enum(['content', 'creator', 'message', 'user', 'all']).default('all'),
  reason: z.enum([
    'illegal_content',
    'underage',
    'harassment',
    'spam',
    'copyright',
    'impersonation',
    'fraud',
    'other',
    'all'
  ]).default('all'),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ReviewReportInput = z.infer<typeof reviewReportSchema>;
export type ListReportsInput = z.infer<typeof listReportsSchema>;
