import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Search, Star, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Button } from '@/components/ui';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { PostCard } from '@/components/cards';
import { CreatorCard } from '@/components/cards';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Content, Creator } from '@/types';

// Convert content to MediaPost format
function contentToMediaPost(content: Content): MediaPost {
  return {
    id: content.id,
    media: content.media.map((m) => ({
      url: m.url,
      type: m.type,
      thumbnailUrl: m.thumbnailUrl || undefined,
      ppvPrice: m.ppvPrice,
      hasAccess: m.hasAccess,
    })),
    text: content.text || undefined,
    creator: {
      id: content.creator?.id || '',
      username: content.creator?.username || '',
      displayName: content.creator?.displayName || '',
      avatarUrl: content.creator?.avatarUrl || undefined,
      isVerified: content.creator?.isVerified || false,
    },
    likeCount: content.likeCount,
    commentCount: content.commentCount,
    viewCount: content.viewCount || 0,
    isLiked: content.isLiked,
    hasBookmarked: content.hasBookmarked,
    hasAccess: content.hasAccess ?? true,
    visibility: content.visibility,
    ppvPrice: content.ppvPrice || undefined,
  };
}

// Horizontal Scroll Section
function HorizontalSection({
  title,
  icon,
  children,
  viewAllLink
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  viewAllLink?: string;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          {icon} {title}
        </h2>
        {viewAllLink && (
          <Link to={viewAllLink} className="text-sm text-brand-500 hover:text-brand-400 flex items-center gap-1">
            Ver todos <ChevronRight size={16} />
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
        {children}
      </div>
    </section>
  );
}

export function Explore() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);
  const { isAuthenticated } = useAuth();

  // Featured creators
  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ['featuredCreators'],
    queryFn: () => api.getFeaturedCreators({ pageSize: 10 }),
  });

  // Recent creators
  const { data: recentData } = useQuery({
    queryKey: ['recentCreators'],
    queryFn: () => api.getRecentCreators(10),
  });

  // Search results
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['searchCreators', searchQuery],
    queryFn: () => api.getCreators({ search: searchQuery }),
    enabled: searchQuery.length > 0,
  });

  // Explore feed (public content)
  const {
    data: exploreData,
    isLoading: exploreLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['exploreFeed', isAuthenticated],
    queryFn: ({ pageParam = 1 }) => api.getExploreFeed({ page: pageParam, pageSize: 12 }),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const allContent = exploreData?.pages.flatMap(page => page.data) || [];
  const featuredCreators = featuredData?.creators || [];
  const recentCreators = recentData?.creators || [];
  const searchResults = searchData?.data || [];

  const handleOpenMedia = (post: Content) => {
    setSelectedPost(contentToMediaPost(post));
  };

  // Show search results when searching
  const showSearchResults = searchQuery.length > 0;

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
      {/* Search Header */}
      <header className="sticky top-0 z-20 bg-dark-900/95 backdrop-blur-md -mx-4 px-4 py-4 border-b border-dark-800">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Busque criadores, tags ou categorias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-800 border border-dark-700 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
          />
        </div>
      </header>

      {showSearchResults ? (
        // Search Results
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white">
            {searchLoading ? 'Buscando...' : `Resultados para "${searchQuery}"`}
          </h2>

          {searchLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-square bg-dark-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {searchResults.map((creator: Creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  variant="featured"
                  showFollowButton={false}
                  showStats
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <Search size={48} className="mx-auto mb-4 text-dark-500" />
              <p className="text-gray-400">Nenhum resultado encontrado para "{searchQuery}"</p>
              <p className="text-sm text-gray-500 mt-2">Tente buscar por outros termos</p>
            </Card>
          )}
        </div>
      ) : (
        // Discovery Content
        <>
          {/* Featured Creators */}
          {featuredCreators.length > 0 && (
            <HorizontalSection
              title="Criadores em Destaque"
              icon={<Star size={20} className="text-yellow-500 fill-yellow-500" />}
            >
              {featuredLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-40 h-52 bg-dark-800 rounded-xl animate-pulse" />
                ))
              ) : (
                featuredCreators.map((creator: Creator) => (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    variant="inline"
                    showFollowButton={false}
                  />
                ))
              )}
            </HorizontalSection>
          )}

          {/* New Creators */}
          {recentCreators.length > 0 && (
            <HorizontalSection
              title="Novos na Plataforma"
              icon={<Sparkles size={20} className="text-purple-500" />}
            >
              {recentCreators.map((creator: Creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  variant="inline"
                  showFollowButton={false}
                />
              ))}
            </HorizontalSection>
          )}

          {/* Trending Content */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp size={20} className="text-red-500" /> Conteúdo em Alta
              </h2>
            </div>

            {exploreLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-square bg-dark-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {allContent.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      variant="grid"
                      showCreatorInfo={false}
                      onOpenMedia={handleOpenMedia}
                    />
                  ))}
                </div>

                {/* Load More */}
                {hasNextPage && (
                  <div className="text-center mt-6">
                    <Button
                      variant="secondary"
                      onClick={() => fetchNextPage()}
                      isLoading={isFetchingNextPage}
                    >
                      Carregar Mais
                    </Button>
                  </div>
                )}

                {allContent.length === 0 && (
                  <Card className="text-center py-12">
                    <TrendingUp size={48} className="mx-auto mb-4 text-dark-500" />
                    <p className="text-gray-400">Nenhum conteúdo público ainda.</p>
                    <p className="text-sm text-gray-500 mt-2">Os criadores ainda não publicaram conteúdo público.</p>
                  </Card>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* Media Viewer Modal */}
      {selectedPost && (
        <MediaViewer
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
}
