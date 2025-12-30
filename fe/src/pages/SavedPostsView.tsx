import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Heart, MessageCircle, MoreVertical, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Avatar } from '@/components/ui';
import { MediaPreview } from '@/components/MediaPreview';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { Content } from '@/types';

function PostCard({ post }: { post: Content }) {
  const queryClient = useQueryClient();

  const toggleBookmark = useMutation({
    mutationFn: () => api.toggleBookmark(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
      toast.success('Post removido dos salvos');
    },
  });

  // Guard against missing creator data
  if (!post.creator) {
    return null;
  }

  const firstMedia = post.media[0];
  const hasVideo = post.media.some(m => m.type === 'video');

  return (
    <Card padding="none" className="overflow-hidden mb-6 animate-slide-up">
      <div className="p-4 flex items-center justify-between">
        <Link to={`/creator/${post.creator.username}`} className="flex items-center gap-3">
          <Avatar src={post.creator.avatarUrl} name={post.creator.displayName} />
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-bold text-white text-sm">{post.creator.displayName}</h3>
              {post.creator.isVerified && (
                <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20" />
              )}
            </div>
            <p className="text-xs text-gray-400">{formatRelativeTime(post.createdAt)}</p>
          </div>
        </Link>
        <button className="text-gray-400 hover:text-white">
          <MoreVertical size={20} />
        </button>
      </div>

      {post.text && (
        <div className="px-4 pb-3">
          <p className="text-gray-200 text-sm whitespace-pre-line">{post.text}</p>
        </div>
      )}

      {firstMedia && (
        <div className="relative aspect-square md:aspect-video w-full bg-dark-900 overflow-hidden">
          <MediaPreview
            url={firstMedia.url}
            thumbnailUrl={firstMedia.thumbnailUrl}
            type={firstMedia.type}
            className="w-full h-full"
            showPlayIcon={hasVideo}
            aspectRatio="auto"
          />
          {post.media.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
              1/{post.media.length}
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors group">
              <Heart size={20} className={post.isLiked ? 'fill-red-500 text-red-500' : 'group-hover:fill-red-500'} />
              <span className="text-sm font-medium">{post.likeCount}</span>
            </button>
            <button className="flex items-center gap-1.5 text-gray-400 hover:text-blue-400 transition-colors">
              <MessageCircle size={20} />
              <span className="text-sm font-medium">{post.commentCount}</span>
            </button>
          </div>
          <button
            onClick={() => toggleBookmark.mutate()}
            className="text-brand-500 hover:text-brand-400 transition-colors"
          >
            <Bookmark size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    </Card>
  );
}

export function SavedPostsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['savedPosts'],
    queryFn: () => api.getSavedPosts(),
  });

  const posts = data?.data || [];

  return (
    <div className="w-full pb-20 md:pb-0 animate-fade-in">
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
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
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
    </div>
  );
}
