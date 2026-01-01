import { Link } from 'react-router-dom';
import { UserPlus, Check, CheckCircle2 } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Creator {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  isVerified?: boolean;
  isFollowing?: boolean;
  subscriberCount?: number;
  postCount?: number;
}

interface CreatorCardProps {
  creator: Creator;
  variant: 'inline' | 'sidebar' | 'featured';
  showFollowButton?: boolean;
  showStats?: boolean;
  isFollowPending?: boolean;
  onFollow?: () => void;
  className?: string;
}

export function CreatorCard({
  creator,
  variant,
  showFollowButton = true,
  showStats = false,
  isFollowPending = false,
  onFollow,
  className = '',
}: CreatorCardProps) {
  // Inline variant - horizontal card for carousel
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex-shrink-0 w-40 bg-dark-800 border border-dark-700 rounded-xl p-3 flex flex-col items-center',
          className
        )}
      >
        <Link to={`/creator/${creator.username}`} className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-brand-500 via-purple-500 to-pink-500 mb-2">
            <Avatar
              src={creator.avatarUrl}
              name={creator.displayName}
              size="lg"
              className="w-full h-full border-2 border-dark-800"
            />
          </div>
          <p className="text-sm font-medium text-white truncate w-full text-center">
            {creator.displayName?.split(' ')[0]}
          </p>
          <p className="text-xs text-gray-500 truncate w-full text-center">
            @{creator.username}
          </p>
        </Link>

        {showFollowButton && onFollow && (
          <Button
            size="sm"
            variant={creator.isFollowing ? 'secondary' : 'primary'}
            onClick={onFollow}
            disabled={isFollowPending}
            className="mt-3 w-full text-xs"
          >
            {creator.isFollowing ? (
              <Check size={14} className="mr-1" />
            ) : (
              <UserPlus size={14} className="mr-1" />
            )}
            {creator.isFollowing ? 'Seguindo' : 'Seguir'}
          </Button>
        )}

        {!showFollowButton && (
          <Link to={`/creator/${creator.username}`} className="w-full mt-3">
            <Button size="sm" variant="secondary" className="w-full text-xs">
              Ver perfil
            </Button>
          </Link>
        )}
      </div>
    );
  }

  // Sidebar variant - vertical list item
  if (variant === 'sidebar') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Link to={`/creator/${creator.username}`}>
          <Avatar
            src={creator.avatarUrl}
            name={creator.displayName}
            size="md"
            className="w-12 h-12"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={`/creator/${creator.username}`}
            className="block font-medium text-white hover:underline truncate"
          >
            <span className="flex items-center gap-1">
              {creator.displayName}
              {creator.isVerified && (
                <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20" />
              )}
            </span>
          </Link>
          <p className="text-sm text-gray-500 truncate">@{creator.username}</p>
        </div>

        {showFollowButton && onFollow && (
          <Button
            size="sm"
            variant={creator.isFollowing ? 'secondary' : 'primary'}
            onClick={onFollow}
            disabled={isFollowPending}
            className="flex-shrink-0"
          >
            {creator.isFollowing ? <Check size={16} /> : <UserPlus size={16} />}
          </Button>
        )}

        {!showFollowButton && (
          <Link to={`/creator/${creator.username}`}>
            <Button size="sm">Ver</Button>
          </Link>
        )}
      </div>
    );
  }

  // Featured variant - large card with cover image
  return (
    <Link
      to={`/creator/${creator.username}`}
      className={cn(
        'group relative block rounded-2xl overflow-hidden bg-dark-800 border border-dark-700 hover:border-dark-600 transition-all',
        className
      )}
    >
      {/* Cover image */}
      <div className="relative h-24 bg-gradient-to-br from-brand-600 to-purple-600">
        {creator.coverUrl && (
          <img
            src={creator.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-800 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative px-4 pb-4 -mt-8">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-brand-500 via-purple-500 to-pink-500 mb-2">
          <Avatar
            src={creator.avatarUrl}
            name={creator.displayName}
            size="lg"
            className="w-full h-full border-2 border-dark-800"
          />
        </div>

        {/* Info */}
        <div className="flex items-center gap-1 mb-1">
          <h3 className="font-bold text-white truncate">{creator.displayName}</h3>
          {creator.isVerified && (
            <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20 flex-shrink-0" />
          )}
        </div>
        <p className="text-sm text-gray-500 mb-2">@{creator.username}</p>

        {/* Stats */}
        {showStats && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            {creator.subscriberCount !== undefined && (
              <span>
                <strong className="text-white">{creator.subscriberCount}</strong> assinantes
              </span>
            )}
            {creator.postCount !== undefined && (
              <span>
                <strong className="text-white">{creator.postCount}</strong> posts
              </span>
            )}
          </div>
        )}

        {/* Follow button */}
        {showFollowButton && onFollow && (
          <Button
            size="sm"
            variant={creator.isFollowing ? 'secondary' : 'primary'}
            onClick={(e) => {
              e.preventDefault();
              onFollow();
            }}
            disabled={isFollowPending}
            className="mt-3 w-full"
          >
            {creator.isFollowing ? (
              <>
                <Check size={16} className="mr-1" />
                Seguindo
              </>
            ) : (
              <>
                <UserPlus size={16} className="mr-1" />
                Seguir
              </>
            )}
          </Button>
        )}
      </div>
    </Link>
  );
}

export default CreatorCard;
