import { useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Check } from 'lucide-react';
import { Avatar, Button, Card } from '@/components/ui';
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
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const followMutation = useMutation({
    mutationFn: (creatorId: string) => api.toggleFavorite(creatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featuredCreators'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteCreators'] });
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
    // Mobile inline version - horizontal avatar carousel
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 px-1">Sugestões para você</h3>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1"
        >
          {creators.map((creator: Creator) => (
            <Link
              key={creator.id}
              to={`/creator/${creator.username}`}
              className="flex-shrink-0 flex flex-col items-center w-16"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-brand-500 via-purple-500 to-pink-500">
                  <Avatar
                    src={creator.avatarUrl}
                    name={creator.displayName}
                    size="lg"
                    className="w-full h-full border-2 border-dark-900"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-300 truncate w-full text-center mt-1.5">
                {creator.displayName?.split(' ')[0]}
              </p>
            </Link>
          ))}
          {/* Loading indicator */}
          {isFetchingNextPage && (
            <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center">
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
            <div key={creator.id} className="flex items-center gap-3">
              <Link to={`/creator/${creator.username}`}>
                <Avatar
                  src={creator.avatarUrl}
                  name={creator.displayName}
                  size="md"
                  className="w-12 h-12"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/creator/${creator.username}`}
                  className="block font-medium text-white hover:underline truncate"
                >
                  {creator.displayName}
                </Link>
                <p className="text-sm text-gray-500 truncate">@{creator.username}</p>
              </div>
              {isAuthenticated && (
                <Button
                  size="sm"
                  variant={creator.isFollowing ? 'secondary' : 'primary'}
                  onClick={() => followMutation.mutate(creator.id)}
                  disabled={followMutation.isPending}
                  className="flex-shrink-0"
                >
                  {creator.isFollowing ? <Check size={16} /> : <UserPlus size={16} />}
                </Button>
              )}
              {!isAuthenticated && (
                <Link to="/">
                  <Button size="sm">Ver</Button>
                </Link>
              )}
            </div>
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
