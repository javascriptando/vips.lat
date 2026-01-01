import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  User,
  Creator,
  Content,
  Subscription,
  Payment,
  Payout,
  CreatorStats,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  ApiResponse,
  PaginatedResponse,
  PaymentResponse,
} from '@/types';

const API_BASE = '/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error: string }>) => {
        let message = 'Erro de conexão';

        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          message = 'Tempo limite excedido. Tente novamente com um arquivo menor.';
        } else if (error.response?.data?.error) {
          message = error.response.data.error;
        } else if (error.response?.status === 413) {
          message = 'Arquivo muito grande para upload.';
        } else if (error.response?.status === 500) {
          message = 'Erro no servidor. Tente novamente.';
        }

        return Promise.reject(new Error(message));
      }
    );
  }

  // Auth
  async register(data: RegisterCredentials): Promise<AuthResponse> {
    const res = await this.client.post<AuthResponse>('/auth/register', data);
    return res.data;
  }

  async login(data: LoginCredentials): Promise<AuthResponse> {
    const res = await this.client.post<AuthResponse>('/auth/login', data);
    return res.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }

  async getMe(): Promise<User | null> {
    try {
      const res = await this.client.get<{ user: User | null }>('/auth/me');
      return res.data.user;
    } catch {
      return null;
    }
  }

  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    const res = await this.client.post('/auth/verify-email', { token });
    return res.data;
  }

  async resendVerification(): Promise<ApiResponse<void>> {
    const res = await this.client.post('/auth/resend-verification');
    return res.data;
  }

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    const res = await this.client.post('/auth/forgot-password', { email });
    return res.data;
  }

  async resetPassword(token: string, password: string): Promise<ApiResponse<void>> {
    const res = await this.client.post('/auth/reset-password', { token, password });
    return res.data;
  }

  // Users
  async getMyProfile(): Promise<User> {
    const res = await this.client.get<User>('/users/me');
    return res.data;
  }

  async updateProfile(data: { name?: string; username?: string }): Promise<User> {
    const res = await this.client.put<{ user: User }>('/users/me', data);
    return res.data.user;
  }

  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.client.post<{ avatarUrl: string }>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  async checkUsername(username: string): Promise<{ available: boolean }> {
    const res = await this.client.get<{ available: boolean }>(`/users/check-username/${username}`);
    return res.data;
  }

  async getPublicProfile(username: string): Promise<{ user: User; creator: Creator | null }> {
    const res = await this.client.get(`/users/${username}`);
    return res.data;
  }

  // Creators
  async becomeCreator(data: {
    displayName: string;
    bio?: string;
    subscriptionPrice: number;
    cpfCnpj?: string;
  }): Promise<Creator> {
    const res = await this.client.post<{ message: string; creator: Creator }>('/creators', data);
    return res.data.creator;
  }

  async getCreators(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Creator>> {
    const res = await this.client.get<PaginatedResponse<Creator>>('/creators', { params });
    return res.data;
  }

  async getMyCreatorProfile(): Promise<Creator> {
    const res = await this.client.get<{ creator: Creator }>('/creators/me');
    return res.data.creator;
  }

  async updateCreatorProfile(data: {
    displayName?: string;
    bio?: string;
    subscriptionPrice?: number;
  }): Promise<Creator> {
    const res = await this.client.put<{ creator: Creator }>('/creators/me', data);
    return res.data.creator;
  }

  async uploadCover(file: File): Promise<{ coverUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.client.post<{ coverUrl: string }>('/creators/me/cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  async setPixKey(pixKey: string, pixKeyType?: string): Promise<ApiResponse<void>> {
    const res = await this.client.post('/creators/me/pix-key', { pixKey, pixKeyType });
    return res.data;
  }

  async getCreatorStats(): Promise<CreatorStats> {
    const res = await this.client.get<{ stats: CreatorStats }>('/creators/me/stats');
    return res.data.stats;
  }

  async getCreatorBalance(): Promise<{ available: number; pending: number }> {
    const res = await this.client.get('/creators/me/balance');
    return res.data;
  }

  async getCreatorByUsername(username: string): Promise<Creator> {
    const res = await this.client.get<{ creator: Creator }>(`/creators/${username}`);
    return res.data.creator;
  }

  async getFeaturedCreators(params?: { page?: number; pageSize?: number }): Promise<{
    creators: Creator[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const res = await this.client.get('/creators/featured', { params });
    return res.data;
  }

  async getRecentCreators(limit: number = 10): Promise<{ creators: Creator[] }> {
    const res = await this.client.get<{ creators: Creator[] }>('/creators/recent', { params: { limit } });
    return res.data;
  }

  // Favorites (Follow creators)
  async toggleFavorite(creatorId: string): Promise<{ favorited: boolean }> {
    const res = await this.client.post(`/favorites/creators/${creatorId}`);
    return res.data;
  }

  async getFavoriteCreators(): Promise<{ creators: Creator[] }> {
    const res = await this.client.get<{ data: Array<{ creator: Creator }> }>('/favorites/creators');
    // Transform the paginated response to match expected format
    return { creators: res.data.data.map(item => item.creator) };
  }

  async checkFavorite(creatorId: string): Promise<{ favorited: boolean }> {
    const res = await this.client.get(`/favorites/creators/${creatorId}/status`);
    return res.data;
  }

  // Stories
  async getStories(): Promise<{
    stories: Array<{
      id: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
      isVerified: boolean;
      hasUnviewed: boolean;
      stories: Array<{
        id: string;
        mediaUrl: string;
        mediaType: 'image' | 'video';
        thumbnailUrl: string | null;
        text: string | null;
        viewCount: number;
        expiresAt: string;
        createdAt: string;
        isViewed: boolean;
      }>;
    }>;
  }> {
    const res = await this.client.get('/stories');
    return res.data;
  }

  // Create story with pre-uploaded media (via chunked upload)
  async createStoryWithMedia(data: {
    mediaUrl: string;
    mediaType: 'image' | 'video';
    text?: string;
  }): Promise<{ message: string; story: unknown }> {
    const res = await this.client.post('/stories', data);
    return res.data;
  }

  // Legacy: Create story with direct file upload (for small files)
  async createStory(file: File, text?: string): Promise<{ message: string; story: unknown }> {
    const formData = new FormData();
    formData.append('file', file);
    if (text) formData.append('text', text);
    const res = await this.client.post('/stories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 5 * 60 * 1000, // 5 minutes for story uploads
    });
    return res.data;
  }

  async markStoryViewed(storyId: string): Promise<{ alreadyViewed: boolean }> {
    const res = await this.client.post(`/stories/${storyId}/view`);
    return res.data;
  }

  async deleteStory(storyId: string): Promise<{ deleted: boolean }> {
    const res = await this.client.delete(`/stories/${storyId}`);
    return res.data;
  }

  async getMyStories(): Promise<{
    stories: Array<{
      id: string;
      mediaUrl: string;
      mediaType: 'image' | 'video';
      thumbnailUrl: string | null;
      text: string | null;
      viewCount: number;
      expiresAt: string;
      createdAt: string;
    }>;
  }> {
    const res = await this.client.get('/stories/me');
    return res.data;
  }

  async getStoryViewers(storyId: string, page = 1): Promise<{
    data: Array<{
      id: string;
      viewedAt: string;
      userId: string;
      username: string;
      name: string;
      avatarUrl: string | null;
    }>;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const res = await this.client.get(`/stories/${storyId}/viewers?page=${page}`);
    return res.data;
  }

  // Messages
  async getConversations(): Promise<{
    conversations: Array<{
      id: string;
      creatorId: string;
      lastMessageAt: string;
      lastMessagePreview: string | null;
      unreadCount: number;
      isBlocked: boolean;
      creatorDisplayName: string;
      creatorUsername: string;
      creatorAvatarUrl: string | null;
      creatorVerified: boolean;
    }>;
  }> {
    const res = await this.client.get('/messages/conversations');
    return res.data;
  }

  async getCreatorConversations(): Promise<{
    conversations: Array<{
      id: string;
      userId: string;
      lastMessageAt: string;
      lastMessagePreview: string | null;
      unreadCount: number;
      isBlocked: boolean;
      userName: string | null;
      userUsername: string;
      userAvatarUrl: string | null;
    }>;
  }> {
    const res = await this.client.get('/messages/conversations/creator');
    return res.data;
  }

  async getMessages(conversationId: string, page = 1): Promise<{
    messages: Array<{
      id: string;
      senderId: string;
      text: string | null;
      mediaUrl: string | null;
      mediaType: string | null;
      isRead: boolean;
      createdAt: string;
      senderName: string | null;
      senderUsername: string;
      senderAvatarUrl: string | null;
    }>;
  }> {
    const res = await this.client.get(`/messages/conversations/${conversationId}/messages`, {
      params: { page, pageSize: 50 },
    });
    return res.data;
  }

  async canSendMessage(creatorId: string): Promise<{ allowed: boolean; reason?: string }> {
    const res = await this.client.get(`/messages/can-send/${creatorId}`);
    return res.data;
  }

  async getOrCreateConversation(creatorId: string): Promise<{
    id: string;
    creatorId: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    creatorDisplayName: string;
    creatorUsername: string;
    creatorAvatarUrl: string | null;
    creatorVerified: boolean;
  }> {
    const res = await this.client.post(`/messages/conversations/get-or-create/${creatorId}`);
    return res.data;
  }

  async sendMessage(creatorId: string, text: string): Promise<{ message: unknown }> {
    const res = await this.client.post('/messages/send', { creatorId, text });
    return res.data;
  }

  async sendMessageAsCreator(conversationId: string, text: string): Promise<{ message: unknown }> {
    const res = await this.client.post(`/messages/conversations/${conversationId}/send`, { text });
    return res.data;
  }

  async markConversationRead(conversationId: string): Promise<{ success: boolean }> {
    const res = await this.client.post(`/messages/conversations/${conversationId}/read`);
    return res.data;
  }

  async getUnreadCount(): Promise<{ asUser: number; asCreator: number; total: number }> {
    const res = await this.client.get('/messages/unread-count');
    return res.data;
  }

  async toggleBlockConversation(conversationId: string): Promise<{ conversation: unknown }> {
    const res = await this.client.post(`/messages/conversations/${conversationId}/toggle-block`);
    return res.data;
  }

  // Content - with pre-uploaded media (from chunked upload)
  async createContentWithMedia(data: {
    type: string;
    visibility: string;
    text?: string;
    media: Array<{
      path: string;
      url: string;
      size: number;
      mimeType: string;
      type: 'image' | 'video';
      isPPV?: boolean;
      ppvPrice?: number;
    }>;
  }): Promise<Content> {
    const res = await this.client.post<{ message: string; content: Content }>('/content', data);
    return res.data.content;
  }

  // Content - with FormData (legacy, for small files)
  async createContent(
    data: FormData,
    onProgress?: (progress: number) => void
  ): Promise<Content> {
    const res = await this.client.post<{ message: string; content: Content }>('/content', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60 * 60 * 1000, // 60 minutes for large video uploads (up to 2.5GB)
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data.content;
  }

  async getFeed(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Content>> {
    const res = await this.client.get<PaginatedResponse<Content>>('/content', { params });
    return res.data;
  }

  async getExploreFeed(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Content>> {
    const res = await this.client.get<PaginatedResponse<Content>>('/content/explore', { params });
    return res.data;
  }

  async getContent(id: string): Promise<Content> {
    const res = await this.client.get<{ content: Content }>(`/content/${id}`);
    return res.data.content;
  }

  async updateContent(id: string, data: { text?: string; visibility?: string }): Promise<Content> {
    const res = await this.client.put<{ content: Content }>(`/content/${id}`, data);
    return res.data.content;
  }

  async deleteContent(id: string): Promise<void> {
    await this.client.delete(`/content/${id}`);
  }

  async toggleLike(contentId: string): Promise<{ liked: boolean; likeCount: number }> {
    const res = await this.client.post(`/content/${contentId}/like`);
    return res.data;
  }

  async trackView(contentId: string): Promise<{ viewCount: number }> {
    const res = await this.client.post(`/content/${contentId}/view`);
    return res.data;
  }

  async getCreatorContent(
    creatorId: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<PaginatedResponse<Content>> {
    const res = await this.client.get<PaginatedResponse<Content>>(`/content/creator/${creatorId}`, { params });
    return res.data;
  }

  async getPurchasedContent(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Content>> {
    const res = await this.client.get<PaginatedResponse<Content>>('/content/purchased', { params });
    return res.data;
  }

  // Bookmarks (Saved Posts)
  async getSavedPosts(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Content>> {
    const res = await this.client.get<PaginatedResponse<Content>>('/favorites/bookmarks', { params });
    return res.data;
  }

  async toggleBookmark(contentId: string): Promise<{ bookmarked: boolean }> {
    const res = await this.client.post(`/favorites/bookmarks/${contentId}`);
    return res.data;
  }

  // Subscriptions
  async subscribe(creatorId: string): Promise<Subscription> {
    const res = await this.client.post<Subscription>('/subscriptions', { creatorId });
    return res.data;
  }

  async getMySubscriptions(): Promise<Subscription[]> {
    const res = await this.client.get<Subscription[]>('/subscriptions');
    return res.data;
  }

  async checkSubscription(creatorId: string): Promise<{ subscribed: boolean; subscription: Subscription | null }> {
    const res = await this.client.get<{ isSubscribed: boolean; subscription: Subscription | null }>(`/subscriptions/check/${creatorId}`);
    // Map backend response to expected format
    return {
      subscribed: res.data.isSubscribed,
      subscription: res.data.subscription,
    };
  }

  async cancelSubscription(id: string): Promise<void> {
    await this.client.delete(`/subscriptions/${id}`);
  }

  async getMySubscribers(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Subscription>> {
    const res = await this.client.get<PaginatedResponse<Subscription>>('/subscriptions/me/subscribers', { params });
    return res.data;
  }

  // Payments
  async paySubscription(
    creatorId: string,
    duration: '1' | '3' | '6' | '12' = '1',
    cpfCnpj?: string
  ): Promise<PaymentResponse> {
    const res = await this.client.post<PaymentResponse>('/payments/subscription', {
      creatorId,
      duration,
      cpfCnpj,
    });
    return res.data;
  }

  async payPPV(contentId: string, mediaIndex?: number, cpfCnpj?: string): Promise<PaymentResponse> {
    const res = await this.client.post<PaymentResponse>('/payments/ppv', {
      contentId,
      mediaIndex,
      cpfCnpj,
    });
    return res.data;
  }

  async sendTip(
    creatorId: string,
    amount: number,
    message?: string,
    contentId?: string,
    cpfCnpj?: string
  ): Promise<PaymentResponse> {
    const res = await this.client.post<PaymentResponse>('/payments/tip', {
      creatorId,
      amount,
      message,
      contentId,
      cpfCnpj,
    });
    return res.data;
  }

  async getPaymentHistory(): Promise<Payment[]> {
    const res = await this.client.get<Payment[]>('/payments');
    return res.data;
  }

  async getPaymentStatus(id: string): Promise<{ status: string }> {
    const res = await this.client.get(`/payments/${id}/status`);
    return res.data;
  }

  async getMyEarnings(): Promise<{ total: number; monthly: number; transactions: Payment[] }> {
    const res = await this.client.get('/payments/me/earnings');
    return res.data;
  }

  // Payouts
  async requestPayout(amount?: number): Promise<Payout> {
    const res = await this.client.post<Payout>('/payouts', { amount });
    return res.data;
  }

  async getPayoutHistory(): Promise<Payout[]> {
    const res = await this.client.get<Payout[]>('/payouts');
    return res.data;
  }

  async getPayoutBalance(): Promise<{ available: number; pending: number; minPayout: number }> {
    const res = await this.client.get('/payouts/balance');
    return res.data;
  }

  // Analytics
  async getBasicAnalytics(): Promise<{
    analytics: {
      overview: {
        totalViews: number;
        totalLikes: number;
        totalSubscribers: number;
        totalPosts: number;
        totalEarnings: number;
      };
      recentActivity: {
        viewsToday: number;
        viewsThisWeek: number;
        likesToday: number;
        likesThisWeek: number;
      };
      topContent: Array<{
        id: string;
        text: string | null;
        viewCount: number;
        likeCount: number;
        publishedAt: string | null;
      }>;
    };
    isPro: boolean;
  }> {
    const res = await this.client.get('/analytics');
    return res.data;
  }

  async getProAnalytics(days?: number): Promise<{
    analytics: {
      viewsHistory: Array<{ date: string; views: number; uniqueViews: number }>;
      earningsHistory: Array<{ date: string; earnings: number }>;
    };
    isPro: boolean;
  }> {
    const res = await this.client.get('/analytics/pro', { params: { days } });
    return res.data;
  }

  // Comments
  async getComments(contentId: string, params?: { page?: number; pageSize?: number }): Promise<{
    data: Array<{
      id: string;
      text: string;
      createdAt: string;
      user: {
        id: string;
        name: string;
        username: string;
        avatarUrl?: string;
      };
      likeCount: number;
      isLiked: boolean;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const res = await this.client.get(`/comments/${contentId}`, { params });
    return res.data;
  }

  async createComment(contentId: string, text: string): Promise<{
    message: string;
    comment: {
      id: string;
      text: string;
      createdAt: string;
    };
  }> {
    const res = await this.client.post(`/comments/${contentId}`, { text });
    return res.data;
  }

  async updateComment(commentId: string, text: string): Promise<{ comment: unknown }> {
    const res = await this.client.put(`/comments/${commentId}`, { text });
    return res.data;
  }

  async deleteComment(commentId: string): Promise<{ message: string }> {
    const res = await this.client.delete(`/comments/${commentId}`);
    return res.data;
  }

  async likeComment(commentId: string): Promise<{ liked: boolean; likeCount: number }> {
    const res = await this.client.post(`/comments/${commentId}/like`);
    return res.data;
  }

  // Packs
  async getMyPacks(params?: { page?: number; pageSize?: number }): Promise<{
    data: Array<{
      id: string;
      name: string;
      description: string | null;
      coverUrl: string | null;
      price: number;
      visibility: 'public' | 'private';
      salesCount: number;
      isActive: boolean;
      media: Array<{ url: string; type: 'image' | 'video'; thumbnailUrl?: string }>;
      createdAt: string;
    }>;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const res = await this.client.get('/packs/me', { params });
    return res.data;
  }

  async getMyPacksAll(): Promise<{
    packs: Array<{
      id: string;
      name: string;
      description: string | null;
      coverUrl: string | null;
      price: number;
      visibility: 'public' | 'private';
      mediaCount: number;
    }>;
  }> {
    const res = await this.client.get('/packs/me/all');
    return res.data;
  }

  async createPack(data: {
    name: string;
    description?: string;
    price: number;
    visibility: 'public' | 'private';
    media: Array<{
      path: string;
      url: string;
      type: 'image' | 'video';
      size: number;
      mimeType: string;
      thumbnailUrl?: string;
    }>;
    coverUrl?: string;
  }): Promise<{ message: string; pack: unknown }> {
    const res = await this.client.post('/packs', data);
    return res.data;
  }

  async updatePack(packId: string, data: {
    name?: string;
    description?: string;
    price?: number;
    visibility?: 'public' | 'private';
    isActive?: boolean;
  }): Promise<{ pack: unknown }> {
    const res = await this.client.put(`/packs/${packId}`, data);
    return res.data;
  }

  async deletePack(packId: string): Promise<{ message: string }> {
    const res = await this.client.delete(`/packs/${packId}`);
    return res.data;
  }

  async getCreatorPacks(creatorId: string, params?: { page?: number; pageSize?: number }): Promise<{
    data: Array<{
      id: string;
      name: string;
      description: string | null;
      coverUrl: string | null;
      price: number;
      mediaCount: number;
      salesCount: number;
      createdAt: string;
    }>;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const res = await this.client.get(`/packs/creator/${creatorId}`, { params });
    return res.data;
  }

  async getPack(packId: string): Promise<{
    pack: {
      id: string;
      name: string;
      description: string | null;
      coverUrl: string | null;
      price: number;
      mediaCount: number;
      salesCount: number;
      hasPurchased: boolean;
      media: Array<{ url: string; type: 'image' | 'video'; thumbnailUrl?: string }>;
      creator: {
        id: string;
        displayName: string;
        username: string;
        avatarUrl: string | null;
        verified: boolean;
      } | null;
      createdAt: string;
    };
  }> {
    const res = await this.client.get(`/packs/${packId}`);
    return res.data;
  }

  async getPurchasedPacks(params?: { page?: number; pageSize?: number }): Promise<{
    data: Array<{
      id: string;
      name: string;
      description: string | null;
      coverUrl: string | null;
      media: Array<{ url: string; type: 'image' | 'video'; thumbnailUrl?: string }>;
      purchasedAt: string;
      creator: {
        id: string;
        displayName: string;
        username: string;
        avatarUrl: string | null;
      } | null;
    }>;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const res = await this.client.get('/packs/purchased', { params });
    return res.data;
  }

  async payPack(packId: string, messageId?: string, cpfCnpj?: string): Promise<PaymentResponse> {
    const res = await this.client.post<PaymentResponse>('/payments/pack', { packId, messageId, cpfCnpj });
    return res.data;
  }

  async payMessagePPV(messageId: string, cpfCnpj?: string): Promise<PaymentResponse> {
    const res = await this.client.post<PaymentResponse>('/payments/message-ppv', { messageId, cpfCnpj });
    return res.data;
  }

  // Send message as creator with optional pack/PPV
  async sendMessageAsCreatorWithMedia(conversationId: string, data: {
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    thumbnailUrl?: string;
    ppvPrice?: number;
    packId?: string;
  }): Promise<{ message: unknown }> {
    const res = await this.client.post(`/messages/conversations/${conversationId}/send`, data);
    return res.data;
  }

  // Upload media for messages (creator only)
  async uploadMedia(formData: FormData): Promise<{ url: string; thumbnailUrl: string | null; type: 'image' | 'video' }> {
    const res = await this.client.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60 * 60 * 1000, // 60 minutes for large uploads (up to 2.5GB)
    });
    return res.data;
  }

  // Get exclusive content (purchased PPV messages - collector items)
  async getExclusiveContent(params?: { page?: number; pageSize?: number }): Promise<{
    data: Array<{
      id: string;
      mediaUrl: string;
      mediaType: 'image' | 'video';
      thumbnailUrl: string | null;
      purchasedAt: string;
      pricePaid: number;
      creator: {
        id: string;
        displayName: string;
        username: string;
        avatarUrl: string | null;
        isVerified: boolean;
      };
    }>;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const res = await this.client.get('/messages/exclusive', { params });
    return res.data;
  }
}

export const api = new ApiClient();
