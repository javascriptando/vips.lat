import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
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

export function SavedPostsView() {
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);
  const [openWithComments, setOpenWithComments] = useState(false);
  const [openWithTip, setOpenWithTip] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['savedPosts'],
    queryFn: () => api.getSavedPosts(),
  });

  // API retorna { data: [{ id, bookmarkedAt, content: {...} }] }
  // Precisamos extrair o content de cada bookmark
  const rawData = data?.data || [];
  const posts = rawData.map((item: any) => ({
    ...item.content,
    bookmarkId: item.id,
    bookmarkedAt: item.bookmarkedAt,
  })) as Content[];

  const handleOpenMedia = (post: Content, options?: { openComments?: boolean; openTip?: boolean }) => {
    setSelectedPost(contentToMediaPost(post));
    setOpenWithComments(options?.openComments || false);
    setOpenWithTip(options?.openTip || false);
  };

  return (
    <div className="max-w-xl mx-auto pb-20 md:pb-0 animate-fade-in">
      <header className="mb-6 flex items-center gap-3 text-white">
        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-500">
          <Bookmark size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Itens Salvos</h1>
          <p className="text-xs text-gray-400">Seus posts favoritos</p>
        </div>
      </header>

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
            />
          ))}

          {posts.length === 0 && (
            <Card className="text-center py-20">
              <Bookmark size={48} className="mx-auto mb-4 text-dark-500" />
              <p className="text-gray-400">Você ainda não salvou nenhum post.</p>
              <Link to="/feed" className="text-brand-500 hover:underline mt-2 inline-block">
                Ver feed
              </Link>
            </Card>
          )}
        </div>
      )}

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
