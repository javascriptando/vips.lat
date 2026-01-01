import { useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui';
import { CreatorCard } from '@/components/cards';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Creator } from '@/types';

interface SuggestionsProps {
  variant?: 'sidebar' | 'inline';
  limit?: number;
}

export function Suggestions({ variant = 'sidebar', limit = 5 }: SuggestionsProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const pageSize = variant === 'inline' ? 20 : limit;

  // Use infinite query for mobile carousel
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['featuredCreators', pageSize],
    queryFn: ({ pageParam = 1 }) => api.getFeaturedCreators({ page: pageParam, pageSize }),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage?.pagination;
      if (pagination && pagination.page < pagination.totalPages) {
        return pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const followMutation = useMutation({
    mutationFn: (creatorId: string) => api.toggleFavorite(creatorId),
    onSuccess: (data) => {
      // Invalidate suggestions
      queryClient.invalidateQueries({ queryKey: ['featuredCreators'] });
      queryClient.invalidateQueries({ queryKey: ['recentCreators'] });
      // Invalidate followed creators and stories
      queryClient.invalidateQueries({ queryKey: ['favoriteCreators'] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      // Invalidate feed (now shows content from new followed creator)
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success(data.favorited ? 'Seguindo!' : 'Deixou de seguir');
    },
    onError: () => {
      toast.error('Erro ao seguir criador');
    },
  });

  // Handle horizontal scroll for infinite loading
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Load more when near the end
    const scrollEnd = container.scrollWidth - container.clientWidth - container.scrollLeft;
    if (scrollEnd < 100 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages of creators
  const allCreators = data?.pages.flatMap(page => page.creators || []) || [];
  const creators = allCreators.filter((c: Creator) => !c.isFollowing);

  if (isLoading) {
    return (
      <div className={variant === 'sidebar' ? 'sticky top-6' : ''}>
        <Card className="p-4">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-dark-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-dark-700 rounded" />
                  <div className="h-3 w-16 bg-dark-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (creators.length === 0) return null;

  if (variant === 'inline') {
    // Mobile/Desktop inline version - horizontal cards with follow button
    return (
      <div className="mb-6 -mx-4 px-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Sugestões para você</h3>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto no-scrollbar pb-2"
        >
          {creators.slice(0, limit).map((creator: Creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              variant="inline"
              showFollowButton={isAuthenticated}
              isFollowPending={followMutation.isPending}
              onFollow={() => followMutation.mutate(creator.id)}
            />
          ))}
          {/* Loading indicator */}
          {isFetchingNextPage && (
            <div className="flex-shrink-0 w-40 h-32 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sidebar version
  return (
    <div className="sticky top-6 space-y-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
          Sugestões para você
        </h3>
        <div className="space-y-4">
          {creators.map((creator: Creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              variant="sidebar"
              showFollowButton={isAuthenticated}
              isFollowPending={followMutation.isPending}
              onFollow={() => followMutation.mutate(creator.id)}
            />
          ))}
        </div>
        <Link
          to="/explore"
          className="block text-center text-sm text-brand-500 hover:text-brand-400 mt-4 font-medium"
        >
          Ver Mais
        </Link>
      </Card>
    </div>
  );
}
