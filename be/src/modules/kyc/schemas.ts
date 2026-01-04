import { z } from 'zod';

export const submitKycSchema = z.object({
  documentType: z.enum(['rg', 'cnh', 'passport']),
  documentNumber: z.string().min(5).max(50).optional(),
  fullName: z.string().min(3).max(255),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
});

export const reviewKycSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().max(500).optional(),
});

export const listKycSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['pending', 'under_review', 'approved', 'rejected', 'expired', 'all']).default('pending'),
});

export type SubmitKycInput = z.infer<typeof submitKycSchema>;
export type ReviewKycInput = z.infer<typeof reviewKycSchema>;
export type ListKycInput = z.infer<typeof listKycSchema>;
