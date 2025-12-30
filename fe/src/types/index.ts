// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  isCreator: boolean;
  createdAt: string;
}

export interface Creator {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriptionPrice: number;
  isVerified: boolean;
  subscriberCount: number;
  followerCount?: number;
  contentCount: number;
  isPro: boolean;
  asaasPixKey: string | null;
  asaasPixKeyType: string | null;
  createdAt: string;
  isFollowing?: boolean;
}

export interface Content {
  id: string;
  creatorId: string;
  type: 'post' | 'image' | 'video';
  text: string | null;
  visibility: 'public' | 'subscribers' | 'ppv';
  ppvPrice: number | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  media: ContentMedia[];
  creator: Creator;
  isLiked?: boolean;
  hasAccess?: boolean;
  hasBookmarked?: boolean;
}

export interface ContentMedia {
  id?: string;
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string | null;
  ppvPrice?: number; // centavos - preço PPV individual desta mídia
  order?: number; // ordem no carrossel
  duration?: number; // duração em segundos (para vídeos)
}

export interface Subscription {
  id: string;
  userId: string;
  creatorId: string;
  status: 'pending' | 'active' | 'cancelled' | 'expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  price: number;
  creator: Creator;
}

export interface Payment {
  id: string;
  userId: string;
  type: 'subscription' | 'ppv' | 'tip' | 'pro';
  status: 'pending' | 'confirmed' | 'failed' | 'refunded' | 'expired';
  amount: number;
  platformFee: number;
  creatorAmount: number;
  createdAt: string;
}

export interface Payout {
  id: string;
  creatorId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pixKey: string;
  createdAt: string;
  processedAt: string | null;
}

export interface CreatorStats {
  totalEarnings: number;
  monthlyEarnings: number;
  subscriberCount: number;
  activeSubscribers: number;
  contentCount: number;
  totalViews: number;
  availableBalance: number;
  pendingBalance: number;
}

export interface Transaction {
  id: string;
  type: 'subscription' | 'ppv' | 'tip';
  amount: number;
  status: 'pending' | 'confirmed';
  userName: string;
  userAvatar: string | null;
  createdAt: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
  username?: string;
}

export interface AuthResponse {
  user: User;
  message: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
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

// QR Code for PIX payments
export interface PixQrCode {
  payload: string;
  image: string;
  expiresAt: string;
}

export interface PaymentResponse {
  message: string;
  payment: Payment;
  qrCode: PixQrCode;
  amount: number;
  pixFee: number;
  total: number;
}
