import { cn, getAvatarUrl, getInitials } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
  hasStory?: boolean;
  hasUnviewedStory?: boolean;
  onClick?: () => void;
}

export function Avatar({
  src,
  name,
  size = 'md',
  className,
  showBorder,
  hasStory,
  hasUnviewedStory,
  onClick,
}: AvatarProps) {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-24 h-24 text-xl',
  };

  // Outer container sizes for story ring (slightly larger for padding)
  const ringContainerSizes = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-[6.5rem] h-[6.5rem]',
  };

  const avatarUrl = getAvatarUrl(src ?? null, name ?? null);

  const avatarContent = (
    <div
      className={cn(
        'rounded-full overflow-hidden bg-dark-700 flex items-center justify-center',
        sizes[size],
        showBorder && 'ring-2 ring-brand-500/30',
        !hasStory && className
      )}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="font-bold text-gray-400">{getInitials(name ?? null)}</span>
      )}
    </div>
  );

  // If has story, wrap with gradient ring
  if (hasStory) {
    return (
      <div
        className={cn(
          'rounded-full p-[2px] flex items-center justify-center',
          ringContainerSizes[size],
          hasUnviewedStory
            ? 'bg-gradient-to-br from-brand-500 via-purple-500 to-pink-500'
            : 'bg-gray-600',
          onClick && 'cursor-pointer hover:scale-105 transition-transform',
          className
        )}
        onClick={onClick}
      >
        <div className="rounded-full bg-dark-900 p-[1px] w-full h-full flex items-center justify-center">
          {avatarContent}
        </div>
      </div>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} className={cn('cursor-pointer', className)}>
        {avatarContent}
      </div>
    );
  }

  return avatarContent;
}
