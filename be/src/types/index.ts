import type { User, Session } from 'lucia';
import type { Creator } from '@/db/schema/creators';

// Hono context variables
export interface AppVariables {
  user: User | null;
  session: Session | null;
  creator: Creator | null;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Pagination input
export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

// Common query params
export interface ListQueryParams extends PaginationInput {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
