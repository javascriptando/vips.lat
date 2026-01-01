import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Avatar, Button } from '@/components/ui';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { StoryViewer, type StoryCreator } from '@/components/media';
import { PostCard } from '@/components/cards';
import { Suggestions } from '@/components/Suggestions';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/utils';
import type { Content } from '@/types';

// Stories bar component with carousel for 100+ stories
function StoriesBar({
  creators,
  onOpenStory,
}: {
  creators: StoryCreator[];
  onOpenStory: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position
  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  // Setup scroll listeners
  useState(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  });

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (creators.length === 0) return null;

  return (
    <div className="mb-6 -mx-4 px-4 relative group">
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-dark-800/90 border border-dark-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-dark-700"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/* Stories container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar py-2 scroll-smooth"
      >
        {creators.map((creator, index) => (
          <button
            key={creator.id}
            onClick={() => onOpenStory(index)}
            className="flex-shrink-0 flex flex-col items-center gap-1 group/story relative"
          >
            <div
              className={`relative w-16 h-16 rounded-full p-[2px] transition-transform group-hover/story:scale-105 ${
                creator.hasUnviewed
                  ? 'bg-gradient-to-br from-brand-500 via-purple-500 to-pink-500'
                  : 'bg-gray-600'
              }`}
            >
              {/* Thumbnail of first story or avatar */}
              {creator.stories[0]?.thumbnailUrl ? (
                <div className="w-full h-full rounded-full border-2 border-dark-900 overflow-hidden">
                  <img
                    src={resolveMediaUrl(creator.stories[0].thumbnailUrl) || ''}
                    alt={creator.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <Avatar
                  src={creator.avatarUrl}
                  name={creator.displayName}
                  className="w-full h-full border-2 border-dark-900"
                />
              )}
              {/* Story count badge */}
              {creator.stories.length > 1 && (
                <span className="absolute -bottom-1 -right-1 text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full font-medium border border-dark-900">
                  {creator.stories.length}
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-400 truncate w-16 text-center">
              {creator.displayName?.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-dark-800/90 border border-dark-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-dark-700"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
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

export function Feed() {
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);
  const [openWithComments, setOpenWithComments] = useState(false);
  const [openWithTip, setOpenWithTip] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [selectedCreatorIndex, setSelectedCreatorIndex] = useState(0);

  // Feed with subscriptions + favorites content
  const { data, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.getFeed(),
  });

  // Stories query
  const { data: storiesData } = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.getStories(),
  });

  const posts = data?.data || [];
  const storyCreators = (storiesData?.stories || []) as StoryCreator[];

  // Create a map of creator IDs to story data for quick lookup
  const creatorStoryMap = useMemo(() => {
    const map = new Map<string, { hasStory: boolean; hasUnviewed: boolean; creatorIndex: number }>();
    storyCreators.forEach((creator, index) => {
      map.set(creator.id, {
        hasStory: true,
        hasUnviewed: creator.hasUnviewed,
        creatorIndex: index,
      });
    });
    return map;
  }, [storyCreators]);

  const handleOpenMedia = (post: Content, options?: { openComments?: boolean; openTip?: boolean }) => {
    setSelectedPost(contentToMediaPost(post));
    setOpenWithComments(options?.openComments || false);
    setOpenWithTip(options?.openTip || false);
  };

  const handleOpenStory = (creatorIndex: number) => {
    setSelectedCreatorIndex(creatorIndex);
    setStoryViewerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-96 bg-dark-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Stories */}
      <StoriesBar creators={storyCreators} onOpenStory={handleOpenStory} />

      {/* Posts */}
      <div>
        {posts.length > 0 ? (
          <>
            {posts.slice(0, 3).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpenMedia={handleOpenMedia}
                creatorStoryData={creatorStoryMap.get(post.creator.id)}
                onOpenStory={handleOpenStory}
              />
            ))}

            {/* Suggestions - after 3 posts (all screen sizes) */}
            <Suggestions variant="inline" limit={8} />

            {posts.slice(3).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpenMedia={handleOpenMedia}
                creatorStoryData={creatorStoryMap.get(post.creator.id)}
                onOpenStory={handleOpenStory}
              />
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

      {/* Story Viewer Modal */}
      {storyViewerOpen && storyCreators.length > 0 && (
        <StoryViewer
          creators={storyCreators}
          initialCreatorIndex={selectedCreatorIndex}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}
    </div>
  );
}
