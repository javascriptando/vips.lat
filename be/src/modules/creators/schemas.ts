import { z } from 'zod';
import { LIMITS } from '@/config/constants';

export const becomeCreatorSchema = z.object({
  displayName: z.string().min(2).max(100),
  bio: z.string().max(500).optional(),
  subscriptionPrice: z.number()
    .min(LIMITS.MIN_SUBSCRIPTION_PRICE, `Preço mínimo é R$ ${(LIMITS.MIN_SUBSCRIPTION_PRICE / 100).toFixed(2)}`)
    .max(LIMITS.MAX_SUBSCRIPTION_PRICE, `Preço máximo é R$ ${(LIMITS.MAX_SUBSCRIPTION_PRICE / 100).toFixed(2)}`),
  cpfCnpj: z.string().optional(),
});

export const updateCreatorSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  subscriptionPrice: z.number()
    .min(LIMITS.MIN_SUBSCRIPTION_PRICE)
    .max(LIMITS.MAX_SUBSCRIPTION_PRICE)
    .optional(),
});

export const setPixKeySchema = z.object({
  pixKey: z.string().min(1, 'Chave PIX é obrigatória'),
  pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP']).optional(),
});

// Helper to parse boolean from query string
const booleanFromString = z.union([
  z.literal('true').transform(() => true),
  z.literal('false').transform(() => false),
  z.literal('1').transform(() => true),
  z.literal('0').transform(() => false),
]).optional();

export const listCreatorsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['subscriberCount', 'createdAt', 'subscriptionPrice']).default('subscriberCount'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  verified: booleanFromString,
  isPro: booleanFromString,
});

export type BecomeCreatorInput = z.infer<typeof becomeCreatorSchema>;
export type UpdateCreatorInput = z.infer<typeof updateCreatorSchema>;
export type SetPixKeyInput = z.infer<typeof setPixKeySchema>;
export type ListCreatorsInput = z.infer<typeof listCreatorsSchema>;
