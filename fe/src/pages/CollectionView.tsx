import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, ShoppingBag, Gift, Sparkles, FolderHeart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { PostCard, PackCard } from '@/components/cards';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/utils';
import type { Content } from '@/types';

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

type Tab = 'saved' | 'purchased' | 'packs' | 'exclusive';

type PurchasedPack = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  media: Array<{ url: string; type: 'image' | 'video'; thumbnailUrl?: string }>;
  purchasedAt: string;
  creator: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  } | null;
};

type ExclusiveItem = {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  thumbnailUrl: string | null;
  purchasedAt: string;
  pricePaid: number;
  creator: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
};

export function CollectionView() {
  const [activeTab, setActiveTab] = useState<Tab>('saved');
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);
  const [openWithComments, setOpenWithComments] = useState(false);
  const [openWithTip, setOpenWithTip] = useState(false);
  const [isExclusiveMedia, setIsExclusiveMedia] = useState(false);

  // Saved posts query
  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['savedPosts'],
    queryFn: () => api.getSavedPosts(),
    enabled: activeTab === 'saved',
  });

  // Purchased content query
  const { data: purchasedData, isLoading: purchasedLoading } = useQuery({
    queryKey: ['purchasedContent'],
    queryFn: () => api.getPurchasedContent(),
    enabled: activeTab === 'purchased',
  });

  // Purchased packs query
  const { data: packsData, isLoading: packsLoading } = useQuery({
    queryKey: ['purchasedPacks'],
    queryFn: () => api.getPurchasedPacks(),
    enabled: activeTab === 'packs',
  });

  // Exclusive message content (collector items)
  const { data: exclusiveData, isLoading: exclusiveLoading } = useQuery({
    queryKey: ['exclusiveContent'],
    queryFn: () => api.getExclusiveContent(),
    enabled: activeTab === 'exclusive',
  });

  // Process saved posts
  const savedRaw = savedData?.data || [];
  const savedPosts = savedRaw.map((item: any) => ({
    ...item.content,
    bookmarkId: item.id,
    bookmarkedAt: item.bookmarkedAt,
  })) as Content[];

  // Purchased posts
  const purchasedPosts = purchasedData?.data || [];

  // Purchased packs
  const purchasedPacks = (packsData?.data || []) as PurchasedPack[];

  // Exclusive content
  const exclusiveItems = (exclusiveData?.data || []) as ExclusiveItem[];

  const isLoading =
    (activeTab === 'saved' && savedLoading) ||
    (activeTab === 'purchased' && purchasedLoading) ||
    (activeTab === 'packs' && packsLoading) ||
    (activeTab === 'exclusive' && exclusiveLoading);

  const handleOpenMedia = (post: Content, options?: { openComments?: boolean; openTip?: boolean }) => {
    setSelectedPost(contentToMediaPost(post));
    setOpenWithComments(options?.openComments || false);
    setOpenWithTip(options?.openTip || false);
  };

  const tabs = [
    { id: 'saved' as Tab, icon: Bookmark, label: 'Salvos', count: savedRaw.length },
    { id: 'purchased' as Tab, icon: ShoppingBag, label: 'Comprados', count: purchasedPosts.length },
    { id: 'packs' as Tab, icon: Gift, label: 'Pacotes', count: purchasedPacks.length },
    { id: 'exclusive' as Tab, icon: Sparkles, label: 'Exclusivos', count: exclusiveItems.length },
  ];

  return (
    <div className="max-w-xl mx-auto px-4 pb-20 md:pb-0 animate-fade-in">
      {/* Header */}
      <header className="mb-6 flex items-center gap-3 text-white">
        <div className="p-2 bg-gradient-to-br from-brand-500/20 to-purple-500/20 rounded-lg">
          <FolderHeart size={24} className="text-brand-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Minha Coleção</h1>
          <p className="text-xs text-gray-400">Seus conteúdos salvos e adquiridos</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-800 p-1 rounded-xl overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[85px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-dark-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Saved Posts */}
            {activeTab === 'saved' && (
              <div>
                {savedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onOpenMedia={handleOpenMedia}
                  />
                ))}
                {savedPosts.length === 0 && (
                  <Card className="text-center py-20">
                    <Bookmark size={48} className="mx-auto mb-4 text-dark-500" />
                    <p className="text-gray-400">Você ainda não salvou nenhum post.</p>
                    <Link to="/feed" className="text-brand-500 hover:underline mt-2 inline-block">
                      Explorar conteúdo
                    </Link>
                  </Card>
                )}
              </div>
            )}

            {/* Purchased Content */}
            {activeTab === 'purchased' && (
              <div>
                {purchasedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onOpenMedia={handleOpenMedia}
                  />
                ))}
                {purchasedPosts.length === 0 && (
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

            {/* Purchased Packs */}
            {activeTab === 'packs' && (
              <div className="grid grid-cols-2 gap-3">
                {purchasedPacks.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={{
                      id: pack.id,
                      name: pack.name,
                      description: pack.description,
                      coverUrl: pack.coverUrl,
                      price: 0,
                      mediaCount: pack.media?.length || 0,
                    }}
                    creator={pack.creator}
                    hasPurchased
                    showCreator
                    compact
                  />
                ))}
                {purchasedPacks.length === 0 && (
                  <Card className="col-span-2 text-center py-20">
                    <Gift size={48} className="mx-auto mb-4 text-dark-500" />
                    <p className="text-gray-400">Você ainda não comprou nenhum pacote.</p>
                    <Link to="/explore" className="text-brand-500 hover:underline mt-2 inline-block">
                      Explorar pacotes
                    </Link>
                  </Card>
                )}
              </div>
            )}

            {/* Exclusive/Collector Items */}
            {activeTab === 'exclusive' && (
              <div>
                {exclusiveItems.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {exclusiveItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-dark-800 rounded-xl overflow-hidden border border-dark-700 group cursor-pointer hover:border-purple-500/50 transition-colors"
                        onClick={() => {
                          // Open media viewer for exclusive items
                          const mediaPost: MediaPost = {
                            id: item.id,
                            media: [{
                              url: item.mediaUrl,
                              type: item.mediaType,
                              thumbnailUrl: item.thumbnailUrl || undefined,
                              hasAccess: true,
                            }],
                            hasAccess: true,
                            visibility: 'private',
                            creator: {
                              ...item.creator,
                              avatarUrl: item.creator.avatarUrl || undefined,
                            },
                            likeCount: 0,
                            commentCount: 0,
                          };
                          setSelectedPost(mediaPost);
                          setIsExclusiveMedia(true);
                        }}
                      >
                        <div className="aspect-square relative overflow-hidden">
                          {item.mediaType === 'video' ? (
                            <video
                              src={resolveMediaUrl(item.mediaUrl) || ''}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <img
                              src={resolveMediaUrl(item.thumbnailUrl || item.mediaUrl) || ''}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          )}
                          <div className="absolute top-2 right-2">
                            <span className="bg-purple-500/90 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles size={10} />
                              Exclusivo
                            </span>
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={resolveMediaUrl(item.creator.avatarUrl) || ''}
                              alt={item.creator.displayName}
                              className="w-5 h-5 rounded-full"
                            />
                            <span className="text-xs text-gray-400 truncate">
                              De {item.creator.displayName}
                            </span>
                          </div>
                          <p className="text-[10px] text-purple-400 mt-1">
                            Só você tem este conteúdo
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card className="text-center py-20">
                    <Sparkles size={48} className="mx-auto mb-4 text-purple-500/50" />
                    <p className="text-gray-400">Nenhum conteúdo exclusivo ainda.</p>
                    <p className="text-xs text-gray-500 mt-2 max-w-xs mx-auto">
                      Conteúdos enviados diretamente para você em conversas aparecem aqui como itens de colecionador.
                    </p>
                  </Card>
                )}
              </div>
            )}
          </>
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
            setIsExclusiveMedia(false);
          }}
          initialShowComments={openWithComments}
          initialShowTip={openWithTip}
          hideInteractions={isExclusiveMedia}
        />
      )}
    </div>
  );
}

export default CollectionView;
