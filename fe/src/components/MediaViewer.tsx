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
  Eye,
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Avatar, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { formatRelativeTime, formatCurrency, resolveMediaUrl, formatCount } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useVideoMute } from '@/hooks/useVideoMute';
import { RealTimeEffects, FloatingHearts } from '@/components/RealTimeEffects';
import { PaymentModal } from '@/components/PaymentModal';
import type { PaymentResponse } from '@/types';

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
  ppvPrice?: number;
  order?: number;
  duration?: number;
  hasAccess?: boolean; // Per-media access control
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
  viewCount?: number;
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
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  // Start playing on mount
  useEffect(() => {
    const video = videoRef.current;
    const bgVideo = bgVideoRef.current;
    if (!video) return;
    video.play().catch(() => onPlayingChange(false));
    if (bgVideo) bgVideo.play().catch(() => {});
  }, [src, onPlayingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    const bgVideo = bgVideoRef.current;
    if (video) {
      video.loop = isLooping;
    }
    if (bgVideo) {
      bgVideo.loop = isLooping;
    }
  }, [isLooping]);

  // Sync play/pause state between main and background video
  useEffect(() => {
    const video = videoRef.current;
    const bgVideo = bgVideoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => onPlayingChange(false));
      if (bgVideo) bgVideo.play().catch(() => {});
    } else {
      video.pause();
      if (bgVideo) bgVideo.pause();
    }
  }, [isPlaying, onPlayingChange]);

  // Sync time position between main and background video
  useEffect(() => {
    const video = videoRef.current;
    const bgVideo = bgVideoRef.current;
    if (!video || !bgVideo) return;

    const syncTime = () => {
      if (Math.abs(video.currentTime - bgVideo.currentTime) > 0.3) {
        bgVideo.currentTime = video.currentTime;
      }
    };

    video.addEventListener('seeked', syncTime);
    video.addEventListener('timeupdate', syncTime);

    return () => {
      video.removeEventListener('seeked', syncTime);
      video.removeEventListener('timeupdate', syncTime);
    };
  }, []);

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
      {/* Blurred background using the same video - synced with main video */}
      <video
        ref={bgVideoRef}
        src={src}
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
        muted
        playsInline
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
  thumbnailUrl,
  onUnlock,
  isLoading,
  creatorUsername,
}: {
  price: number;
  thumbnailUrl?: string;
  onUnlock: () => void;
  isLoading: boolean;
  creatorUsername?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Blurred background */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-3xl scale-110 opacity-40"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/50 to-dark-900" />
      )}

      {/* Lock overlay content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center max-w-sm">
        <div className="w-24 h-24 bg-gradient-to-br from-brand-500/30 to-purple-500/30 rounded-full flex items-center justify-center backdrop-blur-md mb-6 border border-white/10">
          <Lock size={48} className="text-white drop-shadow-lg" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">Conteúdo PPV</h3>
        <p className="text-gray-200 mb-6 drop-shadow">
          Desbloqueie este conteúdo exclusivo por apenas
        </p>
        <div className="text-4xl font-bold text-white mb-6 drop-shadow-lg">
          {formatCurrency(price)}
        </div>
        <Button
          onClick={onUnlock}
          isLoading={isLoading}
          className="px-8 py-3 text-lg bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
        >
          <DollarSign size={20} className="mr-2" />
          Desbloquear Agora
        </Button>
        {creatorUsername && (
          <p className="text-gray-400 text-sm mt-4">
            O pagamento vai diretamente para o criador
          </p>
        )}
      </div>
    </div>
  );
}

// Main MediaViewer Component
export function MediaViewer({
  post: initialPost,
  onClose,
  isRouteBased = false,
  initialShowComments = false,
  initialShowTip = false,
  hideInteractions = false,
}: {
  post: MediaPost;
  onClose: () => void;
  isRouteBased?: boolean; // Skip history manipulation when used as a route component
  initialShowComments?: boolean; // Open with comments panel visible
  initialShowTip?: boolean; // Open with tip modal visible
  hideInteractions?: boolean; // Hide like/comment/bookmark/tip buttons (for message media)
}) {
  // Local state for post data - allows updating after payment
  const [post, setPost] = useState<MediaPost>(initialPost);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(initialShowComments);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isLiked, setIsLiked] = useState(initialPost.isLiked || false);
  const [isBookmarked, setIsBookmarked] = useState(initialPost.hasBookmarked || false);
  const [likeCount, setLikeCount] = useState(initialPost.likeCount);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const { isMuted, toggleMute } = useVideoMute();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const queryClient = useQueryClient();
  const location = useLocation();

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
  const [showTipModal, setShowTipModal] = useState(initialShowTip);
  const [tipAmount, setTipAmount] = useState(990); // Default R$9,90
  const [tipMessage, setTipMessage] = useState('');
  const [tipCpf, setTipCpf] = useState('');
  const [isCreatingTip, setIsCreatingTip] = useState(false);
  const [ppvCpf, setPpvCpf] = useState('');
  const [showPpvCpfInput, setShowPpvCpfInput] = useState(false);

  // Sync state with prop changes (when initialPost changes)
  useEffect(() => {
    setPost(initialPost);
    setIsLiked(initialPost.isLiked || false);
    setIsBookmarked(initialPost.hasBookmarked || false);
    setLikeCount(initialPost.likeCount);
  }, [initialPost.id]);

  // Touch/swipe handling for carousel
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);

  const currentMedia = post.media[currentIndex];
  // Content is locked if: content-level PPV/subscribers and no access
  const isContentLocked = !post.hasAccess && (post.visibility === 'ppv' || post.visibility === 'subscribers');
  // Per-media PPV: check individual item's hasAccess (false or undefined with ppvPrice = locked)
  // Also check if URL is empty (backend hides URL for locked content)
  const isMediaPPVLocked = currentMedia?.ppvPrice && currentMedia.ppvPrice > 0 && currentMedia.hasAccess !== true;
  const isMediaLocked = isContentLocked || isMediaPPVLocked || (!currentMedia?.url && currentMedia?.ppvPrice && currentMedia.ppvPrice > 0);
  const isVideo = currentMedia?.type === 'video';

  // Update URL on mount (only for modal usage, not route-based, not private content)
  useEffect(() => {
    if (isRouteBased) return; // Skip history manipulation for route-based usage
    if (hideInteractions) return; // Skip for private content (messages, exclusives)

    // Update URL to show post
    const postUrl = `/post/${post.id}`;
    const previousPath = location.pathname;
    window.history.pushState({ postId: post.id }, '', postUrl);

    // Restore URL on close
    return () => {
      window.history.pushState({}, '', previousPath);
    };
  }, [post.id, location.pathname, isRouteBased, hideInteractions]);

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
    if (hideInteractions) return; // No URL change for private content

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isRouteBased, hideInteractions, onClose]);

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

  const handleUnlockClick = () => {
    setShowPpvCpfInput(true);
  };

  const handleUnlock = async () => {
    if (!ppvCpf || ppvCpf.replace(/\D/g, '').length < 11) {
      toast.error('CPF é obrigatório para pagamentos PIX');
      return;
    }
    setIsPurchasing(true);
    try {
      // Determine if this is per-media PPV or content-level PPV
      const mediaIndex = currentMedia?.ppvPrice && currentMedia.ppvPrice > 0 ? currentIndex : undefined;
      const response = await api.payPPV(post.id, mediaIndex, ppvCpf.replace(/\D/g, ''));
      setPaymentData(response);
      setShowPpvCpfInput(false);
      setShowPaymentModal(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar pagamento');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handlePaymentSuccess = async () => {
    const savedIndex = currentIndex; // Preserve current carousel position
    setShowPaymentModal(false);
    setPaymentData(null);
    setPpvCpf('');
    toast.success('Conteúdo desbloqueado!');

    // Fetch updated content to get new access state
    try {
      const updatedContent = await api.getContent(post.id);
      if (updatedContent) {
        // Convert to MediaPost format and update local state
        const updatedPost: MediaPost = {
          id: updatedContent.id,
          media: updatedContent.media.map((m) => ({
            url: m.url,
            type: m.type,
            thumbnailUrl: m.thumbnailUrl || undefined,
            ppvPrice: m.ppvPrice ?? undefined,
            hasAccess: m.hasAccess,
          })),
          hasAccess: updatedContent.hasAccess ?? true,
          visibility: updatedContent.visibility,
          ppvPrice: updatedContent.ppvPrice || undefined,
          creator: {
            id: updatedContent.creator.id,
            displayName: updatedContent.creator.displayName,
            username: updatedContent.creator.username,
            avatarUrl: updatedContent.creator.avatarUrl || undefined,
            isVerified: updatedContent.creator.isVerified,
          },
          text: updatedContent.text || undefined,
          likeCount: updatedContent.likeCount,
          commentCount: updatedContent.commentCount || 0,
          viewCount: updatedContent.viewCount || 0,
          isLiked: updatedContent.isLiked,
          hasBookmarked: updatedContent.hasBookmarked,
        };
        setPost(updatedPost);
        setCurrentIndex(savedIndex); // Restore carousel position
      }
    } catch (error) {
      console.error('Error fetching updated content:', error);
    }

    // Invalidate other queries in background
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['creatorContent'] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['purchasedContent'] });
    }, 500);
  };

  const handleSendTip = async () => {
    if (tipAmount < 990) {
      toast.error('Valor mínimo é R$9,90');
      return;
    }
    if (!tipCpf || tipCpf.replace(/\D/g, '').length < 11) {
      toast.error('CPF é obrigatório para pagamentos PIX');
      return;
    }
    setIsCreatingTip(true);
    try {
      const response = await api.sendTip(post.creator.id, tipAmount, tipMessage || undefined, post.id, tipCpf.replace(/\D/g, ''));
      setPaymentData(response);
      setShowTipModal(false);
      setShowPaymentModal(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar gorjeta');
    } finally {
      setIsCreatingTip(false);
    }
  };

  const handleTipSuccess = () => {
    setShowPaymentModal(false);
    setPaymentData(null);
    setTipAmount(990);
    setTipMessage('');
    setTipCpf('');
    toast.success('Gorjeta enviada com sucesso!');
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
            {/* 1. Creator Avatar - show link only for posts, just avatar for messages */}
            {!hideInteractions ? (
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
            ) : (
              <div className="relative mb-1">
                <Avatar
                  src={post.creator.avatarUrl}
                  name={post.creator.displayName}
                  size="md"
                  className="border-2 border-white shadow-lg"
                />
              </div>
            )}

            {/* Interaction buttons - hidden for message media */}
            {!hideInteractions && (
              <>
                {/* 2. Like */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike.mutate();
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(true);
                  }}
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

                {/* 3.5. Views */}
                <div className="flex flex-col items-center">
                  <div className="p-2.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                    <Eye size={20} />
                  </div>
                  <span className="text-white text-[11px] font-medium -mt-0.5">{formatCount(post.viewCount || 0)}</span>
                </div>

                {/* 4. Save/Bookmark */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark.mutate();
                  }}
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
                <button onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}>
                  <div className="p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all">
                    <Share2 size={20} />
                  </div>
                </button>

                {/* 6. Tip */}
                <button onClick={(e) => {
                  e.stopPropagation();
                  setShowTipModal(true);
                }}>
                  <div className="p-2.5 rounded-full bg-black/50 text-green-400 hover:bg-green-500/20 backdrop-blur-sm transition-all">
                    <DollarSign size={20} />
                  </div>
                </button>
              </>
            )}

            {/* Video Controls */}
            {isVideo && !isMediaLocked && (
              <>
                <div className="w-6 h-px bg-white/20 my-0.5" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(!isPlaying);
                  }}
                  className="p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                    isMuted ? 'bg-red-500/30 text-red-400' : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLooping(!isLooping);
                  }}
                  className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                    isLooping ? 'bg-brand-500/30 text-brand-400' : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  <Repeat size={20} />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFullscreen();
                  }}
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
                thumbnailUrl={resolveMediaUrl(currentMedia?.thumbnailUrl) || undefined}
                onUnlock={handleUnlockClick}
                isLoading={isPurchasing}
                creatorUsername={post.creator.username}
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

            {/* Real-time Effects */}
            <FloatingHearts contentId={post.id} />
          </div>

          {/* Real-time notifications */}
          <RealTimeEffects contentId={post.id} />

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
        {!hideInteractions && (
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
        )}
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowTipModal(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Enviar Gorjeta</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700 rounded-xl">
              <Avatar
                src={post.creator.avatarUrl}
                name={post.creator.displayName}
                size="md"
              />
              <div>
                <p className="font-semibold text-white">{post.creator.displayName}</p>
                <p className="text-sm text-gray-400">@{post.creator.username}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Valor da gorjeta</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[990, 1990, 4990, 9990].map((value) => (
                  <button
                    key={value}
                    onClick={() => setTipAmount(value)}
                    className={`py-2 rounded-lg text-sm font-medium transition-all ${
                      tipAmount === value
                        ? 'bg-green-500 text-white'
                        : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                    }`}
                  >
                    {formatCurrency(value)}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R$</span>
                <input
                  type="number"
                  value={(tipAmount / 100).toFixed(2)}
                  onChange={(e) => setTipAmount(Math.round(parseFloat(e.target.value || '0') * 100))}
                  className="w-full bg-dark-700 border border-dark-600 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-green-500"
                  min="9.90"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Mínimo: R$9,90</p>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Seu CPF <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={tipCpf}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  const formatted = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                  setTipCpf(formatted);
                }}
                placeholder="000.000.000-00"
                className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">Necessário para pagamentos PIX</p>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Mensagem (opcional)</label>
              <textarea
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                placeholder="Escreva uma mensagem..."
                className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none"
                rows={2}
                maxLength={200}
              />
            </div>

            <Button
              onClick={handleSendTip}
              isLoading={isCreatingTip}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <DollarSign size={18} className="mr-2" />
              Enviar {formatCurrency(tipAmount)}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              O valor vai diretamente para o criador (menos taxas)
            </p>
          </div>
        </div>
      )}

      {/* PPV CPF Input Modal */}
      {showPpvCpfInput && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPpvCpfInput(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Desbloquear Conteúdo</h3>
              <button
                onClick={() => setShowPpvCpfInput(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">
                {formatCurrency(currentMedia?.ppvPrice || post.ppvPrice || 0)}
              </div>
              <p className="text-sm text-gray-400">
                Conteúdo exclusivo de {post.creator.displayName}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Seu CPF <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={ppvCpf}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  const formatted = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                  setPpvCpf(formatted);
                }}
                placeholder="000.000.000-00"
                className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
              <p className="text-xs text-gray-500 mt-1">Necessário para pagamentos PIX</p>
            </div>

            <Button
              onClick={handleUnlock}
              isLoading={isPurchasing}
              className="w-full bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
            >
              <DollarSign size={18} className="mr-2" />
              Pagar com PIX
            </Button>
          </div>
        </div>
      )}

      {/* Payment Modal (for PPV and Tips) */}
      <PaymentModal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentData(null);
        }}
        onSuccess={paymentData?.payment.type === 'tip' ? handleTipSuccess : handlePaymentSuccess}
        paymentData={paymentData}
        title={paymentData?.payment.type === 'tip' ? 'Confirmar Gorjeta' : 'Desbloquear Conteúdo'}
        description={paymentData?.payment.type === 'tip'
          ? `Enviar gorjeta para ${post.creator.displayName}`
          : `Desbloquear conteúdo de ${post.creator.displayName}`
        }
      />
    </div>
  );
}

export default MediaViewer;
