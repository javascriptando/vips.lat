import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui';
import { VideoPlayer } from './VideoPlayer';
import { ImageViewer } from './ImageViewer';
import { ProgressBars } from './ProgressBars';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { X } from 'lucide-react';
import { useVideoMute } from '@/hooks/useVideoMute';

export interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  thumbnailUrl?: string | null;
  text?: string | null;
  viewCount: number;
  expiresAt: string;
  createdAt: string;
  isViewed: boolean;
}

export interface StoryCreator {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
  hasUnviewed: boolean;
  stories: StoryItem[];
}

interface StoryViewerProps {
  creators: StoryCreator[];
  initialCreatorIndex: number;
  onClose: () => void;
}

// Helper to determine initial story index based on view status
function getInitialStoryIndex(stories: StoryItem[]): number {
  const allViewed = stories.every(s => s.isViewed);
  const noneViewed = stories.every(s => !s.isViewed);

  if (allViewed || noneViewed) {
    return 0;
  }

  const firstUnviewedIndex = stories.findIndex(s => !s.isViewed);
  return firstUnviewedIndex >= 0 ? firstUnviewedIndex : 0;
}

export function StoryViewer({
  creators,
  initialCreatorIndex,
  onClose,
}: StoryViewerProps) {
  const [creatorIndex, setCreatorIndex] = useState(initialCreatorIndex);
  const [storyIndex, setStoryIndex] = useState(() =>
    getInitialStoryIndex(creators[initialCreatorIndex]?.stories || [])
  );
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isAnimating, setIsAnimating] = useState<'enter' | 'exit' | null>('enter');
  const { isMuted } = useVideoMute();

  const queryClient = useQueryClient();
  const progressIntervalRef = useRef<NodeJS.Timeout>();

  // Handle enter animation
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(null), 300);
    return () => clearTimeout(timer);
  }, []);

  // Handle close with exit animation
  const handleClose = useCallback(() => {
    setIsAnimating('exit');
    setTimeout(onClose, 300);
  }, [onClose]);

  const currentCreator = creators[creatorIndex];
  const currentStory = currentCreator?.stories[storyIndex];
  const isVideo = currentStory?.mediaType === 'video';

  const STORY_DURATION = 5000; // 5s for images

  const markViewed = useMutation({
    mutationFn: (storyId: string) => api.markStoryViewed(storyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });

  // Mark story as viewed when displayed
  useEffect(() => {
    if (currentStory && !currentStory.isViewed) {
      markViewed.mutate(currentStory.id);
    }
  }, [currentStory?.id]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Progress bar timer for images
  useEffect(() => {
    if (!currentStory || isVideo || isPaused) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      return;
    }

    setProgress(0);
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(100, (elapsed / STORY_DURATION) * 100);
      setProgress(newProgress);
      if (newProgress >= 100) {
        goNext();
      }
    }, 50);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentStory?.id, isVideo, isPaused, creatorIndex, storyIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') handleClose();
      else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [creatorIndex, storyIndex, creators.length, handleClose]);

  const goNext = useCallback(() => {
    setProgress(0);
    if (storyIndex < currentCreator.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else if (creatorIndex < creators.length - 1) {
      const nextCreator = creators[creatorIndex + 1];
      const nextStartIndex = getInitialStoryIndex(nextCreator.stories);
      setCreatorIndex(creatorIndex + 1);
      setStoryIndex(nextStartIndex);
    } else {
      handleClose();
    }
  }, [storyIndex, creatorIndex, currentCreator, creators, handleClose]);

  const goPrev = useCallback(() => {
    setProgress(0);
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else if (creatorIndex > 0) {
      setCreatorIndex(creatorIndex - 1);
      setStoryIndex(creators[creatorIndex - 1].stories.length - 1);
    }
  }, [storyIndex, creatorIndex, creators]);

  const togglePause = () => {
    setIsPaused(!isPaused);
    setIsPlaying(isPaused);
  };

  const handleVideoTimeUpdate = (currentTime: number, duration: number) => {
    if (duration > 0) {
      setProgress((currentTime / duration) * 100);
    }
  };

  if (!currentCreator || !currentStory) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-all duration-300 ease-out ${
        isAnimating === 'enter'
          ? 'opacity-0 scale-95'
          : isAnimating === 'exit'
          ? 'opacity-0 scale-95'
          : 'opacity-100 scale-100'
      }`}
    >
      {/* Progress bars */}
      <ProgressBars
        total={currentCreator.stories.length}
        current={storyIndex}
        progress={progress}
        className="absolute top-4 left-4 right-4 z-20"
      />

      {/* Header */}
      <div className="absolute top-8 left-4 right-16 flex items-center z-20">
        <Link to={`/creator/${currentCreator.username}`} className="flex items-center gap-3">
          <Avatar src={currentCreator.avatarUrl} name={currentCreator.displayName} size="sm" />
          <div>
            <p className="text-white font-semibold text-sm">{currentCreator.displayName}</p>
            <p className="text-white/60 text-xs">{formatRelativeTime(currentStory.createdAt)}</p>
          </div>
        </Link>
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-20 p-2 text-white/80 hover:text-white transition-colors"
      >
        <X size={28} />
      </button>

      {/* Media with blurred background */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <VideoPlayer
            src={currentStory.mediaUrl}
            isMuted={isMuted}
            isLooping={false}
            isPlaying={isPlaying && !isPaused}
            onPlayingChange={setIsPlaying}
            onEnded={goNext}
            onTimeUpdate={handleVideoTimeUpdate}
          />
        ) : (
          <ImageViewer src={currentStory.mediaUrl} />
        )}
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="p-5 bg-black/50 rounded-full backdrop-blur-sm">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
        </div>
      )}

      {/* Text overlay */}
      {currentStory.text && (
        <div className="absolute bottom-20 left-4 right-4 text-center z-10">
          <p className="text-white text-lg font-medium drop-shadow-lg bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg inline-block">
            {currentStory.text}
          </p>
        </div>
      )}

      {/* Navigation areas - invisible tap zones */}
      <button
        onClick={goPrev}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="absolute left-0 top-20 bottom-20 w-1/3 z-10"
        aria-label="Story anterior"
      />
      <button
        onClick={goNext}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="absolute right-0 top-20 bottom-20 w-1/3 z-10"
        aria-label="Próximo story"
      />

      {/* Center tap to pause (mobile) */}
      <button
        onClick={togglePause}
        className="absolute left-1/3 right-1/3 top-20 bottom-20 z-10"
      />

      {/* Creator counter dots */}
      {creators.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {creators.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === creatorIndex ? 'bg-white w-6' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default StoryViewer;
