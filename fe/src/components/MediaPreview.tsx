import { useState, useRef, useEffect } from 'react';
import { Play, Image as ImageIcon } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/utils';

interface MediaPreviewProps {
  url: string;
  thumbnailUrl?: string | null;
  type: 'image' | 'video';
  alt?: string;
  className?: string;
  showPlayIcon?: boolean;
  aspectRatio?: 'square' | 'video' | 'auto';
}

export function MediaPreview({
  url,
  thumbnailUrl,
  type,
  alt = 'Media',
  className = '',
  showPlayIcon = true,
  aspectRatio = 'auto',
}: MediaPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const resolvedUrl = resolveMediaUrl(url);
  const resolvedThumbnail = resolveMediaUrl(thumbnailUrl);

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: '',
  };

  // For videos without thumbnails, capture first frame
  useEffect(() => {
    if (type === 'video' && !resolvedThumbnail && videoRef.current) {
      const video = videoRef.current;
      video.currentTime = 0.1; // Seek slightly to get a frame
    }
  }, [type, resolvedThumbnail]);

  if (type === 'image') {
    return (
      <div className={`relative bg-black overflow-hidden ${aspectClasses[aspectRatio]} ${className}`}>
        {imageError ? (
          <div className="w-full h-full flex items-center justify-center bg-dark-800">
            <ImageIcon size={32} className="text-dark-500" />
          </div>
        ) : (
          <img
            src={resolvedUrl || ''}
            alt={alt}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        )}
      </div>
    );
  }

  // Video type
  return (
    <div className={`relative bg-black overflow-hidden ${aspectClasses[aspectRatio]} ${className}`}>
      {resolvedThumbnail ? (
        // Use thumbnail if available
        <img
          src={resolvedThumbnail}
          alt={alt}
          className="w-full h-full object-contain"
          onError={() => setImageError(true)}
        />
      ) : (
        // Use video element to capture first frame
        <video
          ref={videoRef}
          src={resolvedUrl || ''}
          className="w-full h-full object-contain"
          muted
          playsInline
          preload="metadata"
          onLoadedData={() => {}}
        />
      )}

      {/* Play icon overlay for videos */}
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
          <div className="p-3 bg-black/40 rounded-full backdrop-blur-sm">
            <Play size={24} className="text-white fill-white" />
          </div>
        </div>
      )}
    </div>
  );
}

// Grid preview version (for content grids)
export function MediaGridPreview({
  media,
  hasAccess = true,
  onClick,
}: {
  media: Array<{ url: string; type: 'image' | 'video'; thumbnailUrl?: string | null }>;
  hasAccess?: boolean;
  onClick?: () => void;
}) {
  const firstMedia = media[0];
  if (!firstMedia) return null;

  const hasVideo = media.some(m => m.type === 'video');

  return (
    <div
      onClick={onClick}
      className="relative aspect-square bg-dark-900 overflow-hidden cursor-pointer group"
    >
      <MediaPreview
        url={firstMedia.url}
        thumbnailUrl={firstMedia.thumbnailUrl}
        type={firstMedia.type}
        className="w-full h-full group-hover:opacity-100 opacity-80 transition-opacity"
        showPlayIcon={hasVideo && hasAccess}
        aspectRatio="square"
      />

      {/* Multiple media indicator */}
      {media.length > 1 && (
        <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
          {media.length}
        </div>
      )}
    </div>
  );
}

export default MediaPreview;
