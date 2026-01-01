import { useRef, useEffect } from 'react';
import { Play } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  isMuted: boolean;
  isLooping: boolean;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  showBlurredBackground?: boolean;
  className?: string;
}

export function VideoPlayer({
  src,
  isMuted,
  isLooping,
  isPlaying,
  onPlayingChange,
  onEnded,
  onTimeUpdate,
  showBlurredBackground = true,
  className = '',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resolvedSrc = resolveMediaUrl(src) || '';

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

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && onTimeUpdate) {
      onTimeUpdate(video.currentTime, video.duration);
    }
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
      className={`absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
      onClick={togglePlay}
      data-video-container
    >
      {/* Blurred background using the same video */}
      {showBlurredBackground && (
        <video
          src={resolvedSrc}
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
          muted
          loop
          playsInline
          autoPlay
        />
      )}

      {/* Main video */}
      <video
        ref={videoRef}
        src={resolvedSrc}
        className="relative z-10 w-auto h-auto max-w-full max-h-full object-contain"
        playsInline
        muted={isMuted}
        loop={isLooping}
        onEnded={onEnded}
        onTimeUpdate={handleTimeUpdate}
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

export default VideoPlayer;
