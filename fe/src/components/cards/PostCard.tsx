import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Heart,
  MessageCircle,
  DollarSign,
  Bookmark,
  Lock,
  Unlock,
  CheckCircle2,
  Share2,
  Eye,
} from 'lucide-react';
import { Card, Avatar, Button } from '@/components/ui';
import { MediaPreview } from '@/components/MediaPreview';
import { ReportButton } from '@/components/ReportButton';
import { api } from '@/lib/api';
import { formatCurrency, formatRelativeTime, resolveMediaUrl, formatCount } from '@/lib/utils';
import { toast } from 'sonner';
import type { Content } from '@/types';

interface StoryData {
  hasStory: boolean;
  hasUnviewed: boolean;
  creatorIndex: number;
}

interface PostCardProps {
  post: Content;
  variant?: 'feed' | 'compact' | 'grid';
  showCreatorInfo?: boolean;
  creatorStoryData?: StoryData;
  onOpenMedia?: (post: Content, options?: { openComments?: boolean; openTip?: boolean }) => void;
  onOpenStory?: (creatorIndex: number) => void;
  onRemove?: () => void; // For saved posts to remove from list
}

export function PostCard({
  post,
  variant = 'feed',
  showCreatorInfo = true,
  creatorStoryData,
  onOpenMedia,
  onOpenStory,
  onRemove,
}: PostCardProps) {
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [isBookmarked, setIsBookmarked] = useState(post.hasBookmarked ?? false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);

  // Sync state with prop changes (e.g., from query refetch)
  useEffect(() => {
    setIsLiked(post.isLiked ?? false);
    setLikeCount(post.likeCount ?? 0);
    setIsBookmarked(post.hasBookmarked ?? false);
  }, [post.id, post.isLiked, post.likeCount, post.hasBookmarked]);

  const toggleLike = useMutation({
    mutationFn: () => api.toggleLike(post.id),
    onMutate: async () => {
      const newLiked = !isLiked;
      const newCount = newLiked ? likeCount + 1 : likeCount - 1;
      setIsLiked(newLiked);
      setLikeCount(newCount);
      if (newLiked) {
        setShowLikeAnimation(true);
        setTimeout(() => setShowLikeAnimation(false), 800);
      }
      return { previousLiked: isLiked, previousCount: likeCount };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        setIsLiked(context.previousLiked);
        setLikeCount(context.previousCount);
      }
    },
    onSuccess: (data) => {
      setIsLiked(data.liked);
      setLikeCount(data.likeCount);
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: () => api.toggleBookmark(post.id),
    onMutate: async () => {
      const newBookmarked = !isBookmarked;
      setIsBookmarked(newBookmarked);
      return { previousBookmarked: isBookmarked };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        setIsBookmarked(context.previousBookmarked);
      }
    },
    onSuccess: (data) => {
      setIsBookmarked(data.bookmarked);
      toast.success(data.bookmarked ? 'Post salvo!' : 'Post removido dos salvos');
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
      if (!data.bookmarked && onRemove) {
        onRemove();
      }
    },
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.creator.displayName,
          text: post.text || 'Confira este post!',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      } catch {
        toast.error('Não foi possível compartilhar');
      }
    }
  };

  // Guard against missing creator data
  if (!post.creator) {
    return null;
  }

  const hasVideo = post.media.some(m => m.type === 'video');
  const firstMedia = post.media[0];

  // Grid variant - minimal card for grids
  if (variant === 'grid') {
    return (
      <div
        className="relative aspect-square bg-dark-900 rounded-lg overflow-hidden cursor-pointer group"
        onClick={() => onOpenMedia?.(post)}
      >
        <MediaPreview
          url={firstMedia?.url || ''}
          thumbnailUrl={firstMedia?.thumbnailUrl}
          type={firstMedia?.type || 'image'}
          className="w-full h-full"
          showPlayIcon={hasVideo}
          aspectRatio="square"
        />
        {post.media.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-xs backdrop-blur-sm">
            {post.media.length}
          </div>
        )}
        {/* Hover overlay with stats */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
          <span className="flex items-center gap-1">
            <Heart size={16} className="fill-current" />
            {formatCount(likeCount)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={16} />
            {formatCount(post.commentCount || 0)}
          </span>
        </div>
      </div>
    );
  }

  // Compact variant - smaller padding, no tips
  const isCompact = variant === 'compact';

  return (
    <Card padding="none" className="overflow-hidden mb-6 animate-slide-up">
      {/* Header with creator info */}
      {showCreatorInfo && (
        <div className={isCompact ? 'p-3' : 'p-4'}>
          <div className="flex items-center gap-3">
            <Avatar
              src={post.creator.avatarUrl}
              name={post.creator.displayName}
              size={isCompact ? 'sm' : 'md'}
              hasStory={creatorStoryData?.hasStory}
              hasUnviewedStory={creatorStoryData?.hasUnviewed}
              onClick={
                creatorStoryData?.hasStory && onOpenStory
                  ? () => onOpenStory(creatorStoryData.creatorIndex)
                  : undefined
              }
            />
            <Link to={`/creator/${post.creator.username}`} className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <h3 className={`font-bold text-white truncate ${isCompact ? 'text-xs' : 'text-sm'}`}>
                  {post.creator.displayName}
                </h3>
                {post.creator.isVerified && (
                  <CheckCircle2 size={isCompact ? 12 : 14} className="text-blue-500 fill-blue-500/20 flex-shrink-0" />
                )}
              </div>
              <p className={`text-gray-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                {formatRelativeTime(post.createdAt)}
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* Text content */}
      {post.text && (
        <div
          className={`${isCompact ? 'px-3 pb-2' : 'px-4 pb-3'} cursor-pointer`}
          onClick={() => onOpenMedia?.(post)}
        >
          <p className={`text-gray-200 whitespace-pre-line ${isCompact ? 'text-xs' : 'text-sm'}`}>
            {post.text}
          </p>
        </div>
      )}

      {/* Media */}
      {post.media.length > 0 && (
        <div
          className="relative aspect-square md:aspect-video w-full bg-dark-900 overflow-hidden cursor-pointer"
          onClick={() => onOpenMedia?.(post)}
        >
          {/* Check content-level lock OR per-media PPV lock */}
          {(!post.hasAccess && post.visibility !== 'public') ||
           (firstMedia?.ppvPrice && firstMedia.ppvPrice > 0 && firstMedia.hasAccess !== true) ? (
            // Locked content overlay
            <>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/50 backdrop-blur-xl z-10 p-6 text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md mb-4 animate-pulse">
                  <Lock size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Conteúdo Exclusivo</h3>
                <p className="text-gray-300 text-sm mb-6 max-w-xs">
                  {post.visibility === 'subscribers' && !post.hasAccess
                    ? 'Disponível apenas para assinantes'
                    : 'Conteúdo de compra avulsa'}
                </p>
                {post.visibility === 'subscribers' && !post.hasAccess ? (
                  <Link to={`/creator/${post.creator.username}`}>
                    <Button className="flex items-center gap-2">
                      <Unlock size={18} />
                      Assinar
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className="flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMedia?.(post);
                    }}
                  >
                    <Unlock size={18} />
                    Desbloquear por {formatCurrency(firstMedia?.ppvPrice || post.ppvPrice || 0)}
                  </Button>
                )}
              </div>
              {/* Blurred background - use thumbnail, image, or video first frame */}
              {firstMedia?.thumbnailUrl ? (
                <img
                  src={resolveMediaUrl(firstMedia.thumbnailUrl) || ''}
                  alt=""
                  className="w-full h-full object-cover opacity-30 blur-lg"
                />
              ) : firstMedia?.type === 'image' && firstMedia?.url ? (
                <img
                  src={resolveMediaUrl(firstMedia.url) || ''}
                  alt=""
                  className="w-full h-full object-cover opacity-30 blur-lg"
                />
              ) : firstMedia?.type === 'video' && firstMedia?.url ? (
                <video
                  src={resolveMediaUrl(firstMedia.url) || ''}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover opacity-30 blur-lg"
                  onLoadedMetadata={(e) => {
                    (e.target as HTMLVideoElement).currentTime = 0.1;
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-brand-900/50 to-dark-900" />
              )}
            </>
          ) : (
            // Unlocked content
            <>
              <MediaPreview
                url={firstMedia?.url || ''}
                thumbnailUrl={firstMedia?.thumbnailUrl}
                type={firstMedia?.type || 'image'}
                className="w-full h-full"
                showPlayIcon={hasVideo}
                aspectRatio="auto"
              />
              {post.media.length > 1 && (
                <div className="absolute top-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
                  1/{post.media.length}
                </div>
              )}
              {/* Like Animation */}
              {showLikeAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <Heart
                    size={80}
                    className="text-red-500 fill-red-500 drop-shadow-2xl"
                    style={{ animation: 'like-pop 0.6s ease-out forwards' }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className={isCompact ? 'p-3' : 'p-4'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Like */}
            <button
              onClick={() => toggleLike.mutate()}
              disabled={toggleLike.isPending}
              className={`relative flex items-center gap-1.5 transition-all ${
                isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
              }`}
            >
              <Heart
                size={isCompact ? 18 : 22}
                className={`transition-transform ${isLiked ? 'fill-current scale-110' : ''} ${
                  showLikeAnimation ? 'animate-ping' : ''
                }`}
              />
              <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>
                {formatCount(likeCount)}
              </span>
            </button>

            {/* Comments */}
            <button
              onClick={() => onOpenMedia?.(post, { openComments: true })}
              className="flex items-center gap-1.5 text-gray-400 hover:text-blue-400 transition-colors"
            >
              <MessageCircle size={isCompact ? 18 : 22} />
              <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>
                {formatCount(post.commentCount || 0)}
              </span>
            </button>

            {/* Views */}
            <div className="flex items-center gap-1.5 text-gray-400">
              <Eye size={isCompact ? 18 : 22} />
              <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>
                {formatCount(post.viewCount || 0)}
              </span>
            </div>

            {/* Tip - only in full variant */}
            {!isCompact && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMedia?.(post, { openTip: true });
                }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-green-400 transition-colors"
              >
                <DollarSign size={22} />
              </button>
            )}
          </div>

          {/* Save and Share */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleBookmark.mutate()}
              disabled={toggleBookmark.isPending}
              className={`transition-all ${
                isBookmarked ? 'text-brand-500 scale-110' : 'text-gray-400 hover:text-brand-500'
              }`}
            >
              <Bookmark size={isCompact ? 18 : 22} className={isBookmarked ? 'fill-current' : ''} />
            </button>

            <button
              onClick={handleShare}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Share2 size={isCompact ? 18 : 22} />
            </button>

            <ReportButton
              targetType="content"
              targetId={post.id}
              variant="icon"
              className="!p-1.5"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default PostCard;
