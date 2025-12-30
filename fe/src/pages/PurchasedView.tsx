import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Heart, MessageCircle, Bookmark, MoreVertical, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Avatar } from '@/components/ui';
import { formatCurrency, formatRelativeTime, resolveMediaUrl } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Content } from '@/types';

function PostCard({ post }: { post: Content }) {
  return (
    <Card padding="none" className="overflow-hidden mb-6 animate-slide-up">
      <div className="p-4 flex items-center justify-between">
        <Link to={`/creator/${post.creator.username}`} className="flex items-center gap-3">
          <Avatar src={post.creator.avatarUrl} name={post.creator.displayName} />
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-bold text-white text-sm">{post.creator.displayName}</h3>
              {post.creator.isVerified && (
                <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20" />
              )}
            </div>
            <p className="text-xs text-gray-400">{formatRelativeTime(post.createdAt)}</p>
          </div>
        </Link>
        <button className="text-gray-400 hover:text-white">
          <MoreVertical size={20} />
        </button>
      </div>

      {post.text && (
        <div className="px-4 pb-3">
          <p className="text-gray-200 text-sm whitespace-pre-line">{post.text}</p>
        </div>
      )}

      {post.media.length > 0 && (
        <div className="relative aspect-square md:aspect-video w-full bg-dark-900 overflow-hidden">
          <img src={resolveMediaUrl(post.media[0].url) || ''} alt="Post content" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors group">
              <Heart size={20} className={post.isLiked ? 'fill-red-500 text-red-500' : 'group-hover:fill-red-500'} />
              <span className="text-sm font-medium">{post.likeCount}</span>
            </button>
            <button className="flex items-center gap-1.5 text-gray-400 hover:text-blue-400 transition-colors">
              <MessageCircle size={20} />
              <span className="text-sm font-medium">{post.commentCount}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {post.ppvPrice && (
              <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
                Comprado por {formatCurrency(post.ppvPrice)}
              </span>
            )}
            <button className="text-gray-400 hover:text-brand-500 transition-colors">
              <Bookmark size={20} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PurchasedView() {
  const { data, isLoading } = useQuery({
    queryKey: ['purchasedContent'],
    queryFn: () => api.getPurchasedContent(),
  });

  const posts = data?.data || [];

  return (
    <div className="max-w-xl mx-auto pb-20 md:pb-0 animate-fade-in">
      <header className="mb-6 flex items-center gap-3 text-white">
        <div className="p-2 bg-brand-500/20 rounded-lg text-brand-500">
          <ShoppingBag size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Comprados</h1>
          <p className="text-xs text-gray-400">Conteúdos que você desbloqueou</p>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 bg-dark-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div>
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}

          {posts.length === 0 && (
            <Card className="text-center py-20">
              <ShoppingBag size={48} className="mx-auto mb-4 text-dark-500" />
              <p className="text-gray-400">Você ainda não comprou nenhum conteúdo.</p>
              <Link to="/explore" className="text-brand-500 hover:underline mt-2 inline-block">
                Explorar criadores
              </Link>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
