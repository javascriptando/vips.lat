import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, DollarSign, Bookmark, Lock, Unlock, CheckCircle2, ChevronLeft, ChevronRight, X, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Avatar, Button } from '@/components/ui';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { MediaPreview } from '@/components/MediaPreview';
import { Suggestions } from '@/components/Suggestions';
import { api } from '@/lib/api';
import { formatCurrency, formatRelativeTime, resolveMediaUrl, formatCount } from '@/lib/utils';
import { toast } from 'sonner';
import type { Content } from '@/types';

type StoryCreator = {
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
};

// Story Viewer Modal
function StoryViewer({
  creators,
  initialCreatorIndex,
  onClose,
}: {
  creators: StoryCreator[];
  initialCreatorIndex: number;
  onClose: () => void;
}) {
  const [creatorIndex, setCreatorIndex] = useState(initialCreatorIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const queryClient = useQueryClient();

  const currentCreator = creators[creatorIndex];
  const currentStory = currentCreator?.stories[storyIndex];

  const markViewed = useMutation({
    mutationFn: (storyId: string) => api.markStoryViewed(storyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });

  // Mark story as viewed when displayed
  useState(() => {
    if (currentStory && !currentStory.isViewed) {
      markViewed.mutate(currentStory.id);
    }
  });

  const goNext = () => {
    if (storyIndex < currentCreator.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else if (creatorIndex < creators.length - 1) {
      setCreatorIndex(creatorIndex + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else if (creatorIndex > 0) {
      setCreatorIndex(creatorIndex - 1);
      setStoryIndex(creators[creatorIndex - 1].stories.length - 1);
    }
  };

  if (!currentCreator || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {currentCreator.stories.map((_, idx) => (
          <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className={`h-full bg-white transition-all ${idx < storyIndex ? 'w-full' : idx === storyIndex ? 'w-full' : 'w-0'}`}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
        <Link to={`/creator/${currentCreator.username}`} className="flex items-center gap-3">
          <Avatar src={currentCreator.avatarUrl} name={currentCreator.displayName} size="sm" />
          <div>
            <p className="text-white font-semibold text-sm">{currentCreator.displayName}</p>
            <p className="text-white/60 text-xs">{formatRelativeTime(currentStory.createdAt)}</p>
          </div>
        </Link>
        <button onClick={onClose} className="text-white p-2">
          <X size={24} />
        </button>
      </div>

      {/* Media */}
      <div className="w-full h-full flex items-center justify-center">
        {currentStory.mediaType === 'video' ? (
          <video
            src={resolveMediaUrl(currentStory.mediaUrl) || ''}
            className="max-w-full max-h-full object-contain"
            autoPlay
            playsInline
            onEnded={goNext}
          />
        ) : (
          <img
            src={resolveMediaUrl(currentStory.mediaUrl) || ''}
            alt="Story"
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Text overlay */}
      {currentStory.text && (
        <div className="absolute bottom-20 left-4 right-4 text-center">
          <p className="text-white text-lg font-medium drop-shadow-lg">{currentStory.text}</p>
        </div>
      )}

      {/* Navigation areas */}
      <button
        onClick={goPrev}
        className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-start pl-2"
      >
        {(storyIndex > 0 || creatorIndex > 0) && (
          <ChevronLeft size={32} className="text-white/50" />
        )}
      </button>
      <button
        onClick={goNext}
        className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-end pr-2"
      >
        <ChevronRight size={32} className="text-white/50" />
      </button>
    </div>
  );
}

// Stories bar component
function StoriesBar() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedCreatorIndex, setSelectedCreatorIndex] = useState(0);

  const { data } = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.getStories(),
  });

  const creators = data?.stories || [];

  if (creators.length === 0) return null;

  const openStory = (index: number) => {
    setSelectedCreatorIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="mb-6 -mx-4 px-4">
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
          {creators.map((creator, index) => (
            <button
              key={creator.id}
              onClick={() => openStory(index)}
              className="flex-shrink-0 flex flex-col items-center gap-1"
            >
              <div className={`w-16 h-16 rounded-full p-[2px] ${
                creator.hasUnviewed
                  ? 'bg-gradient-to-br from-brand-500 via-purple-500 to-pink-500'
                  : 'bg-gray-600'
              }`}>
                <Avatar
                  src={creator.avatarUrl}
                  name={creator.displayName}
                  className="w-full h-full border-2 border-dark-900"
                />
              </div>
              <span className="text-xs text-gray-400 truncate w-16 text-center">
                {creator.displayName?.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {viewerOpen && (
        <StoryViewer
          creators={creators}
          initialCreatorIndex={selectedCreatorIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

function PostCard({ post, onOpenMedia }: { post: Content; onOpenMedia?: (post: Content, openComments?: boolean) => void }) {
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [isBookmarked, setIsBookmarked] = useState(post.hasBookmarked ?? false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);

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
        setTimeout(() => setShowLikeAnimation(false), 800);
      }
      return { previousLiked: isLiked, previousCount: likeCount };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context) {
        setIsLiked(context.previousLiked);
        setLikeCount(context.previousCount);
      }
    },
    onSuccess: (data) => {
      // Sync with server response
      setIsLiked(data.liked);
      setLikeCount(data.likeCount);
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
      toast.success(data.bookmarked ? 'Post salvo!' : 'Post removido dos salvos');
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
    },
  });

  const hasVideo = post.media.some(m => m.type === 'video');
  const firstMedia = post.media[0];

  return (
    <Card padding="none" className="overflow-hidden mb-6 animate-slide-up">
      {/* Header */}
      <div className="p-4">
        <Link to={`/creator/${post.creator.username}`} className="flex items-center gap-3">
          <Avatar src={post.creator.avatarUrl} name={post.creator.displayName} />
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-bold text-white text-sm">{post.creator.displayName}</h3>
              {post.creator.isVerified && <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20" />}
            </div>
            <p className="text-xs text-gray-400">{formatRelativeTime(post.createdAt)}</p>
          </div>
        </Link>
      </div>

      {/* Content - clickable to open post */}
      {post.text && (
        <div
          className="px-4 pb-3 cursor-pointer"
          onClick={() => onOpenMedia?.(post)}
        >
          <p className="text-gray-200 text-sm whitespace-pre-line">{post.text}</p>
        </div>
      )}

      {/* Media - always clickable to open post */}
      {post.media.length > 0 && (
        <div
          className="relative aspect-square md:aspect-video w-full bg-dark-900 overflow-hidden cursor-pointer"
          onClick={() => onOpenMedia?.(post)}
        >
          {!post.hasAccess && post.visibility !== 'public' ? (
            <>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/50 backdrop-blur-xl z-10 p-6 text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md mb-4 animate-pulse">
                  <Lock size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Conteúdo Exclusivo</h3>
                <p className="text-gray-300 text-sm mb-6 max-w-xs">
                  {post.visibility === 'subscribers'
                    ? 'Disponível apenas para assinantes'
                    : 'Conteúdo de compra avulsa'}
                </p>
                <Link to={`/creator/${post.creator.username}`}>
                  <Button className="flex items-center gap-2">
                    <Unlock size={18} />
                    {post.visibility === 'subscribers' ? 'Assinar' : `Desbloquear por ${formatCurrency(post.ppvPrice || 0)}`}
                  </Button>
                </Link>
              </div>
              <img
                src={resolveMediaUrl(firstMedia?.thumbnailUrl || firstMedia?.url) || ''}
                alt="Blurred content"
                className="w-full h-full object-cover opacity-30 blur-lg"
              />
            </>
          ) : (
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
                    style={{
                      animation: 'like-pop 0.6s ease-out forwards',
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Actions - order: like, comments, tip, save, share (last) */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Like with animation */}
            <button
              onClick={() => toggleLike.mutate()}
              disabled={toggleLike.isPending}
              className={`relative flex items-center gap-1.5 transition-all ${
                isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
              }`}
            >
              <Heart
                size={22}
                className={`transition-transform ${isLiked ? 'fill-current scale-110' : ''} ${
                  showLikeAnimation ? 'animate-ping' : ''
                }`}
              />
              <span className="text-sm font-medium">{formatCount(likeCount)}</span>
            </button>
            {/* Comments - opens with comments panel */}
            <button
              onClick={() => onOpenMedia?.(post, true)}
              className="flex items-center gap-1.5 text-gray-400 hover:text-blue-400 transition-colors"
            >
              <MessageCircle size={22} />
              <span className="text-sm font-medium">{formatCount(post.commentCount || 0)}</span>
            </button>
            {/* Tip */}
            <button
              onClick={() => toast.info('Gorjeta em breve!')}
              className="flex items-center gap-1.5 text-gray-400 hover:text-green-400 transition-colors"
            >
              <DollarSign size={22} />
              <span className="text-sm font-medium">Tip</span>
            </button>
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
              <Bookmark size={22} className={isBookmarked ? 'fill-current' : ''} />
            </button>
            {/* Share (last) */}
            <button
              onClick={async () => {
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
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Share2 size={22} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Convert Content to MediaPost format for MediaViewer
function contentToMediaPost(content: Content): MediaPost {
  return {
    id: content.id,
    media: content.media.map((m) => ({
      url: m.url,
      type: m.type,
      thumbnailUrl: m.thumbnailUrl || undefined,
      ppvPrice: m.ppvPrice,
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
    isLiked: content.isLiked,
    hasBookmarked: content.hasBookmarked,
  };
}

export function Feed() {
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);
  const [openWithComments, setOpenWithComments] = useState(false);

  // Feed with subscriptions + favorites content
  const { data, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.getFeed(),
  });

  const posts = data?.data || [];

  const handleOpenMedia = (post: Content, openComments = false) => {
    setSelectedPost(contentToMediaPost(post));
    setOpenWithComments(openComments);
  };

  if (isLoading) {
    return (
      <>
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-96 bg-dark-800 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="hidden lg:block" />
      </>
    );
  }

  return (
    <>
      {/* Main Feed Column */}
      <div>
        {/* Stories */}
        <StoriesBar />

        {/* Posts */}
        <div>
          {posts.length > 0 ? (
            <>
              {posts.slice(0, 3).map((post) => (
                <PostCard key={post.id} post={post} onOpenMedia={handleOpenMedia} />
              ))}

              {/* Mobile Suggestions - after 3 posts */}
              <div className="lg:hidden">
                <Suggestions variant="inline" limit={6} />
              </div>

              {posts.slice(3).map((post) => (
                <PostCard key={post.id} post={post} onOpenMedia={handleOpenMedia} />
              ))}
            </>
          ) : (
            <Card className="text-center py-12">
              <p className="text-gray-400 mb-4">Nenhum post no seu feed ainda.</p>
              <Link to="/explore">
                <Button>Explorar criadores</Button>
              </Link>
            </Card>
          )}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Suggestions variant="sidebar" limit={5} />
      </div>

      {/* Media Viewer Modal */}
      {selectedPost && (
        <MediaViewer
          post={selectedPost}
          onClose={() => {
            setSelectedPost(null);
            setOpenWithComments(false);
          }}
          initialShowComments={openWithComments}
        />
      )}
    </>
  );
}
