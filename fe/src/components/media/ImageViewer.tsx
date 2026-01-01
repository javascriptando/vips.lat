import { resolveMediaUrl } from '@/lib/utils';

interface ImageViewerProps {
  src: string;
  alt?: string;
  showBlurredBackground?: boolean;
  className?: string;
}

export function ImageViewer({
  src,
  alt = 'Content',
  showBlurredBackground = true,
  className = '',
}: ImageViewerProps) {
  const resolvedSrc = resolveMediaUrl(src) || '';

  return (
    <div className={`absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}>
      {/* Blurred background using the same image */}
      {showBlurredBackground && (
        <img
          src={resolvedSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
          draggable={false}
        />
      )}

      {/* Main image */}
      <img
        src={resolvedSrc}
        alt={alt}
        className="relative z-10 w-auto h-auto max-w-full max-h-full object-contain"
        draggable={false}
      />
    </div>
  );
}

export default ImageViewer;
