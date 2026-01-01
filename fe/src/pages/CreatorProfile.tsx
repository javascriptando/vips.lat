import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  MessageCircle,
  Share2,
  Users,
  Image as ImageIcon,
  Grid,
  Lock,
  Video,
  Check,
  ArrowLeft,
  UserPlus,
  UserCheck,
  LogIn,
  Package,
} from 'lucide-react';
import { Card, Avatar, Button } from '@/components/ui';
import { PackCard } from '@/components/cards';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { PaymentModal } from '@/components/PaymentModal';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber, resolveMediaUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { PaymentResponse } from '@/types';

// Helper to convert content to MediaPost format
function toMediaPost(post: any, creator: any): MediaPost {
  return {
    id: post.id,
    media: post.media.map((m: any) => ({
      url: m.url,
      type: m.type,
      thumbnailUrl: m.thumbnailUrl || undefined,
      ppvPrice: m.ppvPrice,
      hasAccess: m.hasAccess,
    })),
    hasAccess: post.hasAccess ?? true,
    visibility: post.visibility,
    ppvPrice: post.ppvPrice || undefined,
    creator: {
      id: creator.id,
      displayName: creator.displayName,
      username: creator.username,
      avatarUrl: creator.avatarUrl || undefined,
      isVerified: creator.isVerified,
    },
    text: post.text || undefined,
    likeCount: post.likeCount || 0,
    commentCount: post.commentCount || 0,
    viewCount: post.viewCount || 0,
    isLiked: post.isLiked,
  };
}

export function CreatorProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'posts' | 'media' | 'packs'>('posts');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);

  // Payment states for subscription
  const [showCpfInput, setShowCpfInput] = useState(false);
  const [subscriptionCpf, setSubscriptionCpf] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);

  // Check if user navigated from within our app (has internal history)
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Check if we came from our own app by looking at the referrer or state
    const state = location.state as { fromApp?: boolean } | null;
    const hasInternalHistory = state?.fromApp || (window.history.length > 1 && document.referrer.includes(window.location.origin));
    setCanGoBack(hasInternalHistory);
  }, [location]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  const handleMessage = async () => {
    if (!isAuthenticated) {
      toast.info('Faça login para enviar mensagens');
      navigate('/');
      return;
    }
    if (!creator) return;

    // Navigate to messages - permission check is done in MessagesView
    try {
      navigate('/messages', { state: { creatorId: creator.id } });
    } catch {
      toast.error('Erro ao verificar permissão');
    }
  };

  const { data: creator, isLoading } = useQuery({
    queryKey: ['creator', username],
    queryFn: () => api.getCreatorByUsername(username!),
    enabled: !!username,
  });

  const { data: content } = useQuery({
    queryKey: ['creatorContent', creator?.id, isAuthenticated],
    queryFn: () => api.getCreatorContent(creator!.id),
    enabled: !!creator?.id,
  });

  const { data: subscriptionCheck } = useQuery({
    queryKey: ['subscriptionCheck', creator?.id],
    queryFn: () => api.checkSubscription(creator!.id),
    enabled: !!creator?.id && isAuthenticated,
  });

  const { data: followCheck } = useQuery({
    queryKey: ['followCheck', creator?.id],
    queryFn: () => api.checkFavorite(creator!.id),
    enabled: !!creator?.id && isAuthenticated,
  });

  const { data: packsData } = useQuery({
    queryKey: ['creatorPacks', creator?.id],
    queryFn: () => api.getCreatorPacks(creator!.id),
    enabled: !!creator?.id,
  });

  const toggleFollow = useMutation({
    mutationFn: () => api.toggleFavorite(creator!.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['followCheck', creator?.id] });
      queryClient.invalidateQueries({ queryKey: ['favoriteCreators'] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      // Also invalidate feed and suggestions
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['featuredCreators'] });
      queryClient.invalidateQueries({ queryKey: ['recentCreators'] });
      toast.success(data.favorited ? 'Seguindo!' : 'Deixou de seguir');
    },
    onError: () => toast.error('Erro ao seguir'),
  });

  const handleFollow = () => {
    if (!isAuthenticated) {
      toast.info('Faça login para seguir');
      navigate('/');
      return;
    }
    toggleFollow.mutate();
  };

  // Filter content based on active tab
  const filteredContent = useMemo(() => {
    if (!content?.data) return [];
    if (activeTab === 'media') {
      return content.data.filter((post) => post.media && post.media.length > 0);
    }
    return content.data;
  }, [content?.data, activeTab]);

  // Compute media counts using mediaCount from API (works even for locked content)
  const mediaCounts = useMemo(() => {
    if (!content?.data) return { photos: 0, videos: 0 };
    let photos = 0;
    let videos = 0;
    content.data.forEach((post: any) => {
      // Use mediaCount from API if available, fallback to counting media array
      if (post.mediaCount) {
        photos += post.mediaCount.photos || 0;
        videos += post.mediaCount.videos || 0;
      } else {
        post.media?.forEach((m: { type: string }) => {
          if (m.type === 'image') photos++;
          else if (m.type === 'video') videos++;
        });
      }
    });
    return { photos, videos };
  }, [content?.data]);

  const subscribe = useMutation({
    mutationFn: (cpfCnpj: string) => api.paySubscription(creator!.id, '1', cpfCnpj),
    onSuccess: (data) => {
      setPaymentData(data);
      setShowCpfInput(false);
      setShowPaymentModal(true);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubscribeClick = () => {
    if (!creator) return;
    if (!isAuthenticated) {
      toast.info('Faça login para assinar');
      navigate('/');
      return;
    }
    setShowCpfInput(true);
  };

  const handleSubscribeConfirm = async () => {
    if (!subscriptionCpf || subscriptionCpf.replace(/\D/g, '').length < 11) {
      toast.error('CPF é obrigatório para pagamentos PIX');
      return;
    }
    setIsSubscribing(true);
    try {
      await subscribe.mutateAsync(subscriptionCpf.replace(/\D/g, ''));
    } finally {
      setIsSubscribing(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    setPaymentData(null);
    setSubscriptionCpf('');
    toast.success('Assinatura ativada com sucesso!');

    // Force immediate refetch to update UI
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['subscriptionCheck', creator?.id] }),
      queryClient.refetchQueries({ queryKey: ['creatorContent', creator?.id] }),
    ]);

    // Also invalidate feed to show unlocked content
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="h-64 bg-dark-800 rounded-b-2xl animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 -mt-20">
          <div className="flex gap-6">
            <div className="w-40 h-40 rounded-full bg-dark-700 animate-pulse" />
            <div className="flex-1 space-y-4 mt-24">
              <div className="h-8 w-48 bg-dark-700 rounded animate-pulse" />
              <div className="h-4 w-32 bg-dark-700 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <Card className="text-center py-12">
        <p className="text-gray-400">Criador não encontrado.</p>
      </Card>
    );
  }

  const isSubscribed = subscriptionCheck?.subscribed;
  const isFollowing = followCheck?.favorited;

  return (
    <div className="animate-fade-in pb-20 md:pb-0">
      {/* Back Button - only shows when navigated from within app */}
      {canGoBack && (
        <button
          onClick={() => navigate(-1)}
          className="fixed top-4 left-4 z-50 p-2.5 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
      )}

      {/* Banner & Header */}
      <div className="relative mb-6">
        <div className="h-48 md:h-64 w-full bg-dark-800 relative rounded-b-2xl overflow-hidden">
          {creator.coverUrl ? (
            <img src={resolveMediaUrl(creator.coverUrl) || ''} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-brand-900 to-purple-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative -mt-20">
          <div className="flex flex-col md:flex-row items-end md:items-end gap-6">
            <div className="relative">
              <Avatar
                src={creator.avatarUrl}
                name={creator.displayName}
                className="w-32 h-32 md:w-40 md:h-40 border-4 border-dark-900 shadow-2xl"
              />
              {creator.isVerified && (
                <div className="absolute bottom-2 right-2 p-1.5 bg-blue-500 text-white rounded-full border-2 border-dark-900">
                  <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 mb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                    {creator.displayName}
                  </h1>
                  <p className="text-gray-400 font-medium">@{creator.username}</p>
                </div>

                <div className="flex gap-3">
                  {/* Follow Button */}
                  <button
                    onClick={handleFollow}
                    disabled={toggleFollow.isPending}
                    className={`p-2.5 rounded-lg transition-colors ${
                      isFollowing
                        ? 'bg-brand-500 text-white'
                        : 'bg-dark-800 border border-dark-700 hover:bg-dark-700 text-white'
                    }`}
                    title={isFollowing ? 'Seguindo' : 'Seguir'}
                  >
                    {toggleFollow.isPending ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isFollowing ? (
                      <UserCheck size={20} />
                    ) : (
                      <UserPlus size={20} />
                    )}
                  </button>
                  <button
                    onClick={handleMessage}
                    className="p-2.5 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 transition-colors text-white"
                  >
                    <MessageCircle size={20} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-2.5 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 transition-colors text-white"
                  >
                    <Share2 size={20} />
                  </button>
                  {!isAuthenticated ? (
                    <Button onClick={handleSubscribeClick}>
                      <LogIn size={18} /> Entrar para Assinar
                    </Button>
                  ) : isSubscribed ? (
                    <Button variant="secondary" disabled>
                      <Check size={18} /> Assinando
                    </Button>
                  ) : (
                    <Button onClick={handleSubscribeClick} isLoading={isSubscribing}>
                      Assinar por {formatCurrency(creator.subscriptionPrice)}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Bio & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="md:col-span-2 space-y-4">
            <p className="text-gray-300 leading-relaxed whitespace-pre-line">
              {creator.bio || 'Este criador ainda não adicionou uma descrição.'}
            </p>
            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <UserPlus size={18} className="text-brand-500" />
                <span className="text-white font-bold">{formatNumber(creator.followerCount || 0)}</span>
                <span className="hidden sm:inline">Seguidores</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Users size={18} className="text-purple-500" />
                <span className="text-white font-bold">{formatNumber(creator.subscriberCount)}</span>
                <span className="hidden sm:inline">Assinantes</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Grid size={18} className="text-blue-500" />
                <span className="text-white font-bold">{creator.contentCount}</span>
                <span className="hidden sm:inline">Posts</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <ImageIcon size={18} className="text-green-500" />
                <span className="text-white font-bold">{mediaCounts.photos}</span>
                <span className="hidden sm:inline">Fotos</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Video size={18} className="text-red-500" />
                <span className="text-white font-bold">{mediaCounts.videos}</span>
                <span className="hidden sm:inline">Vídeos</span>
              </div>
            </div>
          </div>

          <Card>
            <h3 className="font-bold text-white mb-3 text-sm uppercase tracking-wider">Assinatura Inclui</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <Check size={16} className="text-brand-500" /> Acesso total ao feed
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-brand-500" /> Mensagens diretas
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-brand-500" /> Conteúdo exclusivo semanal
              </li>
            </ul>
          </Card>
        </div>

        {/* Content Tabs */}
        <div className="border-b border-dark-800 mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'posts' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Grid size={18} /> Posts
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'media' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <ImageIcon size={18} /> Mídia
            </button>
            {(packsData?.data?.length ?? 0) > 0 && (
              <button
                onClick={() => setActiveTab('packs')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'packs' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Package size={18} /> Pacotes
              </button>
            )}
          </div>
        </div>

        {/* Content Grid */}
        {activeTab !== 'packs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContent.map((post: any) => {
            const hasVideo = post.media.some((m: { type: string }) => m.type === 'video');
            const firstMedia = post.media[0];
            const isContentLocked = !post.hasAccess && post.visibility !== 'public';
            const isMediaPPVLocked = firstMedia?.ppvPrice && firstMedia.ppvPrice > 0 && firstMedia.hasAccess !== true;
            const isLocked = isContentLocked || isMediaPPVLocked;
            // Use mediaCount for total count when media is hidden
            const totalMediaCount = post.mediaCount?.total || post.media.length;
            const hasVideoContent = post.mediaCount?.videos > 0 || hasVideo;

            return (
              <div
                key={post.id}
                onClick={() => creator && setSelectedPost(toMediaPost(post, creator))}
                className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden group hover:border-dark-600 transition-colors cursor-pointer"
              >
                <div className="relative aspect-square">
                  {/* Background - show thumbnail, image, or video first frame */}
                  {firstMedia?.thumbnailUrl ? (
                    <img
                      src={resolveMediaUrl(firstMedia.thumbnailUrl) || ''}
                      alt=""
                      className={`w-full h-full object-cover transition-opacity ${
                        isLocked ? 'opacity-40 blur-sm' : 'opacity-80 group-hover:opacity-100'
                      }`}
                    />
                  ) : firstMedia?.type === 'image' && firstMedia?.url ? (
                    <img
                      src={resolveMediaUrl(firstMedia.url) || ''}
                      alt=""
                      className={`w-full h-full object-cover transition-opacity ${
                        isLocked ? 'opacity-40 blur-sm' : 'opacity-80 group-hover:opacity-100'
                      }`}
                    />
                  ) : firstMedia?.type === 'video' && firstMedia?.url ? (
                    <video
                      src={resolveMediaUrl(firstMedia.url) || ''}
                      muted
                      playsInline
                      preload="metadata"
                      className={`w-full h-full object-cover transition-opacity ${
                        isLocked ? 'opacity-40 blur-sm' : 'opacity-80 group-hover:opacity-100'
                      }`}
                      onLoadedMetadata={(e) => {
                        // Seek to first frame to show preview
                        (e.target as HTMLVideoElement).currentTime = 0.1;
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${
                      isLocked ? 'bg-dark-800' : 'bg-gradient-to-br from-dark-700 to-dark-800'
                    }`}>
                      {hasVideoContent ? (
                        <Video size={32} className="text-dark-500" />
                      ) : (
                        <ImageIcon size={32} className="text-dark-500" />
                      )}
                    </div>
                  )}
                  {/* Unlocked content - show play icon for videos */}
                  {!isLocked && hasVideo && firstMedia?.url && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="p-3 bg-black/50 rounded-full backdrop-blur-sm">
                        <Video size={24} className="text-white" />
                      </div>
                    </div>
                  )}
                  {/* Lock overlay */}
                  {isLocked && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-center">
                      <div className="p-3 bg-white/10 rounded-full backdrop-blur-md mb-2">
                        <Lock size={24} className="text-white" />
                      </div>
                      <span className="text-white text-xs font-medium">
                        {isContentLocked ? 'Exclusivo' : formatCurrency(firstMedia?.ppvPrice || 0)}
                      </span>
                    </div>
                  )}
                  {totalMediaCount > 1 && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
                      {totalMediaCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Placeholders */}
          {filteredContent.length === 0 && (
            <>
              <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden aspect-square relative flex items-center justify-center">
                <ImageIcon size={32} className="text-dark-600" />
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden aspect-square relative flex items-center justify-center">
                <Video size={32} className="text-dark-600" />
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden aspect-square relative flex items-center justify-center">
                <Lock size={32} className="text-dark-600" />
              </div>
            </>
          )}
        </div>
        )}

        {/* Packs Grid */}
        {activeTab === 'packs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packsData?.data?.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                showSales
              />
            ))}
            {(!packsData?.data || packsData.data.length === 0) && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Package size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhum pacote disponível</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media Viewer Modal */}
      {selectedPost && (
        <MediaViewer post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}

      {/* CPF Input Modal for Subscription */}
      {showCpfInput && creator && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowCpfInput(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Assinar Criador</h3>
              <button
                onClick={() => setShowCpfInput(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700 rounded-xl">
              <Avatar
                src={creator.avatarUrl}
                name={creator.displayName}
                size="md"
              />
              <div>
                <p className="font-semibold text-white">{creator.displayName}</p>
                <p className="text-sm text-gray-400">@{creator.username}</p>
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">
                {formatCurrency(creator.subscriptionPrice)}
                <span className="text-sm font-normal text-gray-400">/mês</span>
              </div>
              <p className="text-sm text-gray-400">
                Acesso a todo conteúdo exclusivo
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Seu CPF <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={subscriptionCpf}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  const formatted = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                  setSubscriptionCpf(formatted);
                }}
                placeholder="000.000.000-00"
                className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
              <p className="text-xs text-gray-500 mt-1">Necessário para pagamentos PIX</p>
            </div>

            <Button
              onClick={handleSubscribeConfirm}
              isLoading={isSubscribing}
              className="w-full bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
            >
              Assinar Agora
            </Button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentData(null);
        }}
        onSuccess={handlePaymentSuccess}
        paymentData={paymentData}
        title="Assinar Criador"
        description={creator ? `Assinatura mensal de ${creator.displayName}` : undefined}
      />
    </div>
  );
}
