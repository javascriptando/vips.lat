import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { ImageViewer } from './ImageViewer';
import { ProgressBars } from './ProgressBars';
import { useVideoMute } from '@/hooks/useVideoMute';

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
  duration?: number;
}

export interface BaseMediaViewerProps {
  media: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;

  // Mode configuration
  mode?: 'post' | 'story';

  // Story-specific props
  showProgressBars?: boolean;
  autoAdvance?: boolean;
  autoAdvanceDuration?: number; // ms for images
  onAutoAdvanceComplete?: () => void;
  progress?: number; // External progress control (0-100)

  // UI slots
  header?: ReactNode;
  actionSidebar?: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;

  // Callbacks
  onMediaView?: (index: number) => void;

  // Styling
  className?: string;
  zIndex?: number;
}

export function BaseMediaViewer({
  media,
  initialIndex = 0,
  onClose,
  onIndexChange,
  mode = 'post',
  showProgressBars = false,
  autoAdvance = false,
  autoAdvanceDuration = 5000,
  onAutoAdvanceComplete,
  progress: externalProgress,
  header,
  actionSidebar,
  footer,
  overlay,
  onMediaView,
  className = '',
  zIndex = 100,
}: BaseMediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [internalProgress, setInternalProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const { isMuted } = useVideoMute();
  const isLooping = mode === 'post';

  const progressIntervalRef = useRef<NodeJS.Timeout>();
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const currentMedia = media[currentIndex];
  const isVideo = currentMedia?.type === 'video';
  const progress = externalProgress ?? internalProgress;

  // Notify index changes
  useEffect(() => {
    onIndexChange?.(currentIndex);
    onMediaView?.(currentIndex);
  }, [currentIndex, onIndexChange, onMediaView]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Auto-advance timer for images in story mode
  useEffect(() => {
    if (!autoAdvance || isVideo || isPaused) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      return;
    }

    setInternalProgress(0);
    const startTime = Date.now();

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(100, (elapsed / autoAdvanceDuration) * 100);
      setInternalProgress(newProgress);

      if (newProgress >= 100) {
        goNext();
      }
    }, 50);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentIndex, isVideo, isPaused, autoAdvance, autoAdvanceDuration]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(p => !p);
          setIsPlaying(p => !p);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, media.length]);

  const goNext = useCallback(() => {
    setInternalProgress(0);
    if (currentIndex < media.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onAutoAdvanceComplete?.();
    }
  }, [currentIndex, media.length, onAutoAdvanceComplete]);

  const goPrev = useCallback(() => {
    setInternalProgress(0);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

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
        goNext();
      } else {
        goPrev();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleVideoTimeUpdate = (currentTime: number, duration: number) => {
    if (duration > 0) {
      setInternalProgress((currentTime / duration) * 100);
    }
  };

  const handleVideoEnded = () => {
    if (autoAdvance) {
      goNext();
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    setIsPlaying(isPaused);
  };

  if (!currentMedia) return null;

  return (
    <div
      className={`fixed inset-0 bg-black flex flex-col ${className}`}
      style={{ zIndex }}
      onClick={onClose}
    >
      {/* Progress bars (story mode) */}
      {showProgressBars && (
        <ProgressBars
          total={media.length}
          current={currentIndex}
          progress={progress}
          className="absolute top-4 left-4 right-4 z-20"
        />
      )}

      {/* Header slot */}
      {header && (
        <div className="absolute top-8 left-4 right-16 z-20" onClick={e => e.stopPropagation()}>
          {header}
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 text-white/80 hover:text-white transition-colors"
      >
        <X size={28} />
      </button>

      {/* Media counter (post mode, multiple media) */}
      {mode === 'post' && media.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-sm">
          {currentIndex + 1} / {media.length}
        </div>
      )}

      {/* Action sidebar slot */}
      {actionSidebar && (
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5"
          onClick={e => e.stopPropagation()}
        >
          {actionSidebar}
        </div>
      )}

      {/* Main media area */}
      <div
        className="flex-1 flex items-center justify-center relative"
        onClick={e => e.stopPropagation()}
        onTouchStart={media.length > 1 ? handleTouchStart : undefined}
        onTouchMove={media.length > 1 ? handleTouchMove : undefined}
        onTouchEnd={media.length > 1 ? handleTouchEnd : undefined}
      >
        {/* Media content */}
        {isVideo ? (
          <VideoPlayer
            src={currentMedia.url}
            isMuted={isMuted}
            isLooping={isLooping}
            isPlaying={isPlaying}
            onPlayingChange={setIsPlaying}
            onEnded={handleVideoEnded}
            onTimeUpdate={handleVideoTimeUpdate}
          />
        ) : (
          <ImageViewer src={currentMedia.url} />
        )}

        {/* Overlay slot (for animations, lock screens, etc.) */}
        {overlay}

        {/* Pause indicator (story mode) */}
        {mode === 'story' && isPaused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="p-5 bg-black/50 rounded-full backdrop-blur-sm">
              <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Navigation areas (story mode) */}
      {mode === 'story' && (
        <>
          <button
            onClick={goPrev}
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onMouseLeave={() => setIsPaused(false)}
            className="absolute left-0 top-20 bottom-20 w-1/3 flex items-center justify-start pl-4 z-10"
          >
            {currentIndex > 0 && (
              <ChevronLeft size={36} className="text-white/50 hover:text-white transition-colors" />
            )}
          </button>
          <button
            onClick={goNext}
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onMouseLeave={() => setIsPaused(false)}
            className="absolute right-0 top-20 bottom-20 w-1/3 flex items-center justify-end pr-4 z-10"
          >
            <ChevronRight size={36} className="text-white/50 hover:text-white transition-colors" />
          </button>
          {/* Center tap to pause */}
          <button
            onClick={togglePause}
            className="absolute left-1/3 right-1/3 top-20 bottom-20 z-10"
          />
        </>
      )}

      {/* Dot indicators (post mode, multiple media) */}
      {mode === 'post' && media.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 px-4 z-10">
          {media.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}

      {/* Footer slot */}
      {footer && (
        <div className="absolute bottom-20 left-4 right-4 z-10" onClick={e => e.stopPropagation()}>
          {footer}
        </div>
      )}
    </div>
  );
}

// Export video controls hook for external use
export function useMediaViewerControls() {
  const { isMuted, toggleMute } = useVideoMute();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);

  return {
    isMuted,
    toggleMute,
    isPlaying,
    setIsPlaying,
    isLooping,
    setIsLooping,
  };
}

export default BaseMediaViewer;
