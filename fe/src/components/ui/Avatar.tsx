import { cn, getAvatarUrl, getInitials } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

export function Avatar({ src, name, size = 'md', className, showBorder }: AvatarProps) {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-24 h-24 text-xl',
  };

  const avatarUrl = getAvatarUrl(src ?? null, name ?? null);

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden bg-dark-700 flex items-center justify-center',
        sizes[size],
        showBorder && 'ring-2 ring-brand-500/30',
        className
      )}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-bold text-gray-400">{getInitials(name ?? null)}</span>
      )}
    </div>
  );
}
