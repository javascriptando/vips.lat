import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, ShoppingBag, Folder } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { PostCard } from '@/components/cards';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { api } from '@/lib/api';
import type { Content } from '@/types';

// Convert Content to MediaPost format for MediaViewer
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
    hasAccess: content.hasAccess ?? true,
    visibility: content.visibility,
    ppvPrice: content.ppvPrice || undefined,
    creator: {
      id: content.creator.id,
      displayName: content.creator.displayName,
      username: content.creator.username,
      avatarUrl: content.creator.avatarUrl || undefined,
      isVerified: content.creator.isVerified,
    },
    text: content.text || undefined,
    likeCount: content.likeCount,
    commentCount: content.commentCount || 0,
    viewCount: content.viewCount || 0,
    isLiked: content.isLiked,
    hasBookmarked: content.hasBookmarked,
  };
}

type Tab = 'saved' | 'purchased';

export function MyContentView() {
  const [activeTab, setActiveTab] = useState<Tab>('saved');
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);
  const [openWithComments, setOpenWithComments] = useState(false);
  const [openWithTip, setOpenWithTip] = useState(false);

  // Saved posts query
  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['savedPosts'],
    queryFn: () => api.getSavedPosts(),
    enabled: activeTab === 'saved',
  });

  // Purchased content query
  const { data: purchasedData, isLoading: purchasedLoading } = useQuery({
    queryKey: ['purchasedContent'],
    queryFn: () => api.getPurchasedContent(),
    enabled: activeTab === 'purchased',
  });

  // Process saved posts
  const savedRaw = savedData?.data || [];
  const savedPosts = savedRaw.map((item: any) => ({
    ...item.content,
    bookmarkId: item.id,
    bookmarkedAt: item.bookmarkedAt,
  })) as Content[];

  // Purchased posts
  const purchasedPosts = purchasedData?.data || [];

  const isLoading = activeTab === 'saved' ? savedLoading : purchasedLoading;
  const posts = activeTab === 'saved' ? savedPosts : purchasedPosts;

  const handleOpenMedia = (post: Content, options?: { openComments?: boolean; openTip?: boolean }) => {
    setSelectedPost(contentToMediaPost(post));
    setOpenWithComments(options?.openComments || false);
    setOpenWithTip(options?.openTip || false);
  };

  const handleRemoveSaved = () => {
    // The PostCard handles the removal via mutation
    // This callback could be used for additional UI updates if needed
  };

  return (
    <div className="max-w-xl mx-auto px-4 pb-20 md:pb-0 animate-fade-in">
      {/* Header */}
      <header className="mb-6 flex items-center gap-3 text-white">
        <div className="p-2 bg-brand-500/20 rounded-lg text-brand-500">
          <Folder size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Meus Conteúdos</h1>
          <p className="text-xs text-gray-400">Salvos e comprados</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-dark-800 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'saved'
              ? 'bg-brand-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-dark-700'
          }`}
        >
          <Bookmark size={16} />
          Salvos
        </button>
        <button
          onClick={() => setActiveTab('purchased')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'purchased'
              ? 'bg-brand-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-dark-700'
          }`}
        >
          <ShoppingBag size={16} />
          Comprados
        </button>
      </div>

      {/* Content - min-height to prevent layout shift */}
      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-dark-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpenMedia={handleOpenMedia}
                onRemove={activeTab === 'saved' ? handleRemoveSaved : undefined}
              />
            ))}

            {posts.length === 0 && (
              <Card className="text-center py-20">
                {activeTab === 'saved' ? (
                  <>
                    <Bookmark size={48} className="mx-auto mb-4 text-dark-500" />
                    <p className="text-gray-400">Você ainda não salvou nenhum post.</p>
                    <Link to="/feed" className="text-brand-500 hover:underline mt-2 inline-block">
                      Explorar conteúdo
                    </Link>
                  </>
                ) : (
                  <>
                    <ShoppingBag size={48} className="mx-auto mb-4 text-dark-500" />
                    <p className="text-gray-400">Você ainda não comprou nenhum conteúdo.</p>
                    <Link to="/explore" className="text-brand-500 hover:underline mt-2 inline-block">
                      Explorar conteúdo
                    </Link>
                  </>
                )}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Media Viewer Modal */}
      {selectedPost && (
        <MediaViewer
          post={selectedPost}
          onClose={() => {
            setSelectedPost(null);
            setOpenWithComments(false);
            setOpenWithTip(false);
          }}
          initialShowComments={openWithComments}
          initialShowTip={openWithTip}
        />
      )}
    </div>
  );
}

export default MyContentView;
