import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MessageCircle,
  Heart,
  Send,
  Lock,
  Bookmark,
  Share2,
  Maximize,
  Repeat,
  DollarSign,
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Avatar, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { formatRelativeTime, formatCurrency, resolveMediaUrl, formatCount } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useVideoMute } from '@/hooks/useVideoMute';

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
  ppvPrice?: number;
  order?: number;
  duration?: number;
}

export interface MediaPost {
  id: string;
  media: MediaItem[];
  hasAccess: boolean;
  visibility: string;
  ppvPrice?: number; // Content-level PPV price in cents
  creator: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
    isVerified?: boolean;
  };
  text?: string;
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  hasBookmarked?: boolean;
}

interface Comment {
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
}

// Video Player with external controls
function VideoPlayer({
  src,
  isMuted,
  isLooping,
  isPlaying,
  onPlayingChange,
}: {
  src: string;
  isMuted: boolean;
  isLooping: boolean;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => onPlayingChange(false));
  }, [src, onPlayingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.loop = isLooping;
    }
  }, [isLooping]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => onPlayingChange(false));
    } else {
      video.pause();
    }
  }, [isPlaying, onPlayingChange]);

  const togglePlay = () => {
    onPlayingChange(!isPlaying);
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (video) {
      video.requestFullscreen();
    }
  };

  // Expose fullscreen function via data attribute
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      (video as HTMLVideoElement & { goFullscreen: () => void }).goFullscreen = handleFullscreen;
    }
  }, []);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      onClick={togglePlay}
      data-video-container
    >
      {/* Blurred background using the same video */}
      <video
        src={src}
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
        muted
        loop
        playsInline
        autoPlay
      />

      {/* Main video */}
      <video
        ref={videoRef}
        src={src}
        className="relative z-10 w-auto h-auto max-w-full max-h-full object-contain"
        playsInline
        muted={isMuted}
        loop={isLooping}
        data-video-element
      />

      {/* Center Play/Pause Indicator - shows when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="p-5 bg-black/50 rounded-full backdrop-blur-sm">
            <Play size={48} className="text-white fill-white ml-1" />
          </div>
        </div>
      )}
    </div>
  );
}

// Simple Image Viewer with blurred background
function ImageViewer({ src }: { src: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Blurred background using the same image */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
        draggable={false}
      />

      {/* Main image */}
      <img
        src={src}
        alt="Content"
        className="relative z-10 w-auto h-auto max-w-full max-h-full object-contain"
        draggable={false}
      />
    </div>
  );
}

// Inline Comments Panel - used for both mobile and desktop
function InlineCommentsPanel({
  contentId,
  onClose,
}: {
  contentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [newComment, setNewComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['comments', contentId],
    queryFn: () => api.getComments(contentId),
  });

  const comments: Comment[] = data?.data || [];

  const addComment = useMutation({
    mutationFn: (text: string) => api.createComment(contentId, text),
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['comments', contentId] });
      toast.success('Comentário adicionado!');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const likeComment = useMutation({
    mutationFn: (commentId: string) => api.likeComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', contentId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuthenticated) return;
    addComment.mutate(newComment);
  };

  return (
    <div className="flex flex-col h-full bg-dark-800" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 shrink-0">
        <h3 className="text-base font-bold text-white">Comentários</h3>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-dark-700"
        >
          <X size={20} />
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-gray-500 py-6 text-sm">Nenhum comentário ainda</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              <Avatar src={comment.user.avatarUrl} name={comment.user.name} size="xs" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-white truncate">{comment.user.name}</span>
                  <span className="text-[10px] text-gray-500">{formatRelativeTime(comment.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5 break-words">{comment.text}</p>
                <button
                  onClick={() => likeComment.mutate(comment.id)}
                  className="flex items-center gap-1 mt-1 text-[10px] text-gray-500 hover:text-red-400"
                >
                  <Heart size={12} className={comment.isLiked ? 'fill-red-500 text-red-500' : ''} />
                  {comment.likeCount > 0 && comment.likeCount}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input - compact with proper spacing */}
      {isAuthenticated && (
        <form onSubmit={handleSubmit} className="px-4 py-4 border-t border-dark-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar src={user?.avatarUrl} name={user?.name} size="xs" className="shrink-0" />
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicione um comentário..."
              className="flex-1 bg-dark-700 border border-dark-600 rounded-full px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-500 min-w-0"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || addComment.isPending}
              className="w-6 h-6 flex items-center justify-center bg-brand-500 text-white rounded-full disabled:opacity-50 shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// PPV Lock Overlay
function PPVLockOverlay({
  price,
  onUnlock,
  isLoading,
}: {
  price: number;
  onUnlock: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center z-10 p-6 text-center">
      <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md mb-6 animate-pulse">
        <Lock size={40} className="text-white" />
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">Conteúdo Exclusivo</h3>
      <p className="text-gray-300 mb-6">Desbloqueie este item para visualizar</p>
      <Button onClick={onUnlock} isLoading={isLoading} className="px-8">
        Desbloquear por {formatCurrency(price)}
      </Button>
    </div>
  );
}

// Main MediaViewer Component
export function MediaViewer({
  post,
  onClose,
  onPurchase,
  isRouteBased = false,
  initialShowComments = false,
}: {
  post: MediaPost;
  onClose: () => void;
  onPurchase?: (mediaIndex: number) => Promise<void>;
  isRouteBased?: boolean; // Skip history manipulation when used as a route component
  initialShowComments?: boolean; // Open with comments panel visible
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(initialShowComments);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isBookmarked, setIsBookmarked] = useState(post.hasBookmarked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const { isMuted, toggleMute } = useVideoMute();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const queryClient = useQueryClient();
  const location = useLocation();

  // Touch/swipe handling for carousel
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);

  const currentMedia = post.media[currentIndex];
  // Content is locked if: per-media PPV (individual item has price) OR content-level PPV (visibility='ppv' and no access)
  const isContentLocked = !post.hasAccess && (post.visibility === 'ppv' || post.visibility === 'subscribers');
  const isMediaLocked = isContentLocked || (currentMedia?.ppvPrice && currentMedia.ppvPrice > 0 && !post.hasAccess);
  const isVideo = currentMedia?.type === 'video';

  // Update URL on mount (only for modal usage, not route-based)
  useEffect(() => {
    if (isRouteBased) return; // Skip history manipulation for route-based usage

    // Update URL to show post
    const postUrl = `/post/${post.id}`;
    const previousPath = location.pathname;
    window.history.pushState({ postId: post.id }, '', postUrl);

    // Restore URL on close
    return () => {
      window.history.pushState({}, '', previousPath);
    };
  }, [post.id, location.pathname, isRouteBased]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showComments) return; // Don't navigate when comments open
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'c') setShowComments((s) => !s);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, post.media.length, showComments]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle browser back button for modal usage
  useEffect(() => {
    if (isRouteBased) return; // Router handles back for route-based usage

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isRouteBased, onClose]);

  const goNext = () => {
    if (currentIndex < post.media.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;

    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        // Swipe left -> next
        goNext();
      } else {
        // Swipe right -> prev
        goPrev();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleUnlock = async () => {
    if (!onPurchase) return;
    setIsPurchasing(true);
    try {
      await onPurchase(currentIndex);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['creatorContent'] });
    } finally {
      setIsPurchasing(false);
    }
  };

  const toggleLike = useMutation({
    mutationFn: () => api.toggleLike(post.id),
    // Optimistic update
    onMutate: async () => {
      const newLiked = !isLiked;
      const newCount = newLiked ? likeCount + 1 : likeCount - 1;
      setIsLiked(newLiked);
      setLikeCount(newCount);
      if (newLiked) {
        setShowLikeAnimation(true);
        setTimeout(() => setShowLikeAnimation(false), 1000);
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
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: () => api.toggleBookmark(post.id),
    // Optimistic update
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
      toast.success(data.bookmarked ? 'Salvo!' : 'Removido dos salvos');
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
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

  const handleFullscreen = () => {
    const video = document.querySelector('[data-video-element]') as HTMLVideoElement;
    if (video) {
      video.requestFullscreen();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      onClick={onClose}
    >
      {/* Main Container - flex column on mobile, row on desktop */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Media Area */}
        <div
          className={`relative flex-1 flex flex-col transition-all duration-300 ease-out ${
            showComments ? 'md:flex-[2]' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button - Top Left */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-20 p-2 text-white/80 hover:text-white transition-colors"
          >
            <X size={28} />
          </button>

          {/* Counter - Top Center (for multiple media) */}
          {post.media.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-sm">
              {currentIndex + 1} / {post.media.length}
            </div>
          )}

          {/* Vertical Action Sidebar - Right */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5">
            {/* 1. Creator Avatar */}
            <Link
              to={`/creator/${post.creator.username}`}
              className="relative mb-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar
                src={post.creator.avatarUrl}
                name={post.creator.displayName}
                size="md"
                className="border-2 border-white shadow-lg"
              />
            </Link>

            {/* 2. Like */}
            <button
              onClick={() => toggleLike.mutate()}
              disabled={toggleLike.isPending}
              className="flex flex-col items-center"
            >
              <div className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                isLiked
                  ? 'bg-red-500/30 text-red-500'
                  : 'bg-black/50 text-white hover:bg-black/70'
              }`}>
                <Heart size={20} className={isLiked ? 'fill-current' : ''} />
              </div>
              <span className={`text-[11px] font-medium -mt-0.5 ${isLiked ? 'text-red-500' : 'text-white'}`}>
                {formatCount(likeCount)}
              </span>
            </button>

            {/* 3. Comments */}
            <button
              onClick={() => setShowComments(true)}
              className="flex flex-col items-center"
            >
              <div className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                showComments
                  ? 'bg-brand-500/30 text-brand-400'
                  : 'bg-black/50 text-white hover:bg-black/70'
              }`}>
                <MessageCircle size={20} />
              </div>
              <span className="text-white text-[11px] font-medium -mt-0.5">{formatCount(post.commentCount)}</span>
            </button>

            {/* 4. Save/Bookmark */}
            <button
              onClick={() => toggleBookmark.mutate()}
              disabled={toggleBookmark.isPending}
            >
              <div className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                isBookmarked
                  ? 'bg-brand-500/30 text-brand-500'
                  : 'bg-black/50 text-white hover:bg-black/70'
              }`}>
                <Bookmark size={20} className={isBookmarked ? 'fill-current' : ''} />
              </div>
            </button>

            {/* 5. Share */}
            <button onClick={handleShare}>
              <div className="p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all">
                <Share2 size={20} />
              </div>
            </button>

            {/* 6. Tip */}
            <button onClick={() => toast.info('Gorjeta em breve!')}>
              <div className="p-2.5 rounded-full bg-black/50 text-green-400 hover:bg-green-500/20 backdrop-blur-sm transition-all">
                <DollarSign size={20} />
              </div>
            </button>

            {/* Video Controls */}
            {isVideo && !isMediaLocked && (
              <>
                <div className="w-6 h-px bg-white/20 my-0.5" />

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>

                <button
                  onClick={toggleMute}
                  className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                    isMuted ? 'bg-red-500/30 text-red-400' : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                    isLooping ? 'bg-brand-500/30 text-brand-400' : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  <Repeat size={20} />
                </button>

                <button
                  onClick={handleFullscreen}
                  className="p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all"
                >
                  <Maximize size={20} />
                </button>
              </>
            )}
          </div>

          {/* Media Display with swipe support */}
          <div
            ref={mediaContainerRef}
            className="flex-1 flex items-center justify-center relative"
            onTouchStart={post.media.length > 1 ? handleTouchStart : undefined}
            onTouchMove={post.media.length > 1 ? handleTouchMove : undefined}
            onTouchEnd={post.media.length > 1 ? handleTouchEnd : undefined}
          >
            {isMediaLocked ? (
              <PPVLockOverlay
                price={currentMedia?.ppvPrice || post.ppvPrice || 0}
                onUnlock={handleUnlock}
                isLoading={isPurchasing}
              />
            ) : currentMedia?.type === 'video' ? (
              <VideoPlayer
                src={resolveMediaUrl(currentMedia.url) || ''}
                isMuted={isMuted}
                isLooping={isLooping}
                isPlaying={isPlaying}
                onPlayingChange={setIsPlaying}
              />
            ) : (
              <ImageViewer src={resolveMediaUrl(currentMedia?.url) || ''} />
            )}

            {/* Like Animation */}
            {showLikeAnimation && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                <Heart
                  size={120}
                  className="text-red-500 fill-red-500 animate-bounce drop-shadow-2xl"
                  style={{ animation: 'like-pop 0.6s ease-out forwards' }}
                />
              </div>
            )}
          </div>

          {/* Dot indicators for multiple media (mobile-friendly) */}
          {post.media.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 px-4 z-10">
              {post.media.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex
                      ? 'bg-white w-6'
                      : 'bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Comments Panel - inline for both mobile and desktop with smooth animation */}
        <div
          className={`
            bg-dark-800 border-dark-700 overflow-hidden
            md:border-l md:flex-shrink-0
            border-t md:border-t-0
            transition-all duration-300 ease-out
            ${showComments
              ? 'max-h-[45vh] md:max-h-full md:w-96 opacity-100'
              : 'max-h-0 md:max-h-full md:w-0 opacity-0 md:opacity-100'
            }
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`h-full transition-opacity duration-200 ${showComments ? 'opacity-100' : 'opacity-0'}`}>
            <InlineCommentsPanel
              contentId={post.id}
              onClose={() => setShowComments(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MediaViewer;
