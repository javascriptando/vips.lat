import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Layers, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { PaymentModal } from '@/components/PaymentModal';
import { api } from '@/lib/api';
import { resolveMediaUrl, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaymentResponse } from '@/types';

export function PackView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
  const [showCpfInput, setShowCpfInput] = useState(false);
  const [cpf, setCpf] = useState('');
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pack', id],
    queryFn: () => api.getPack(id!),
    enabled: !!id,
  });

  const pack = data?.pack;
  const hasPurchased = pack?.hasPurchased ?? false;
  const media = (pack?.media || []) as Array<{ url: string; type: 'image' | 'video'; thumbnailUrl?: string }>;

  // Auto-open MediaViewer when pack is purchased and has media
  useEffect(() => {
    if (hasPurchased && media.length > 0) {
      setShowViewer(true);
    }
  }, [hasPurchased, media.length]);

  const handlePurchase = () => {
    setShowCpfInput(true);
  };

  const handleCreatePayment = async () => {
    if (!cpf || cpf.replace(/\D/g, '').length < 11) {
      toast.error('CPF é obrigatório');
      return;
    }
    if (!id) return;

    setIsCreatingPayment(true);
    try {
      const response = await api.payPack(id, undefined, cpf.replace(/\D/g, ''));
      setPaymentData(response);
      setShowCpfInput(false);
      setShowPaymentModal(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar pagamento');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setPaymentData(null);
    setCpf('');
    toast.success('Pacote desbloqueado!');
    queryClient.invalidateQueries({ queryKey: ['pack', id] });
    queryClient.invalidateQueries({ queryKey: ['purchasedPacks'] });
    refetch();
  };

  const handleCloseViewer = () => {
    setShowViewer(false);
    navigate(-1);
  };

  // Build MediaPost for carousel viewer
  const mediaPost: MediaPost | null = pack && pack.creator ? {
    id: pack.id,
    media: media.map((m) => ({
      url: m.url,
      type: m.type,
      thumbnailUrl: m.thumbnailUrl,
      hasAccess: hasPurchased,
    })),
    hasAccess: hasPurchased,
    visibility: 'public',
    creator: {
      id: pack.creator.id,
      displayName: pack.creator.displayName,
      username: pack.creator.username,
      avatarUrl: pack.creator.avatarUrl || undefined,
      isVerified: pack.creator.verified,
    },
    likeCount: 0,
    commentCount: 0,
    text: pack.name,
  } : null;

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-dark-700 rounded animate-pulse mb-6" />
        <div className="aspect-video bg-dark-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 text-center">
        <Layers size={48} className="mx-auto mb-4 text-dark-500" />
        <h1 className="text-xl font-bold text-white mb-2">Pacote não encontrado</h1>
        <p className="text-gray-400 mb-4">Este pacote pode ter sido removido ou não existe.</p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft size={18} className="mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  // If purchased and viewer is open, show MediaViewer fullscreen
  if (showViewer && hasPurchased && mediaPost) {
    return (
      <MediaViewer
        post={mediaPost}
        onClose={handleCloseViewer}
        hideInteractions
      />
    );
  }

  // Show purchase page if not purchased
  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white">Pacote</h1>
      </div>

      {/* Pack Preview - Gift Box Style */}
      <div className="flex justify-center mb-6">
        <div className="relative w-64 aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-brand-600/20 via-dark-800 to-dark-900 border-2 border-brand-500/30 shadow-xl">
          {/* Gift ribbon - vertical */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-full bg-gradient-to-b from-brand-500/40 via-brand-500/20 to-brand-500/40" />
          {/* Gift ribbon - horizontal */}
          <div className="absolute top-1/3 left-0 w-full h-8 bg-gradient-to-r from-brand-500/40 via-brand-500/20 to-brand-500/40" />
          {/* Ribbon bow */}
          <div className="absolute top-[calc(33%-16px)] left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-brand-500/30 border-2 border-brand-500/50 flex items-center justify-center">
            <Layers size={24} className="text-brand-400" />
          </div>

          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 pt-20">
            <h3 className="font-bold text-white text-center text-lg leading-tight line-clamp-2 mb-2">{pack.name}</h3>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Layers size={14} />
              <span>{pack.mediaCount} {pack.mediaCount === 1 ? 'item' : 'itens'}</span>
            </div>
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-black/60 rounded-full p-4">
              <Lock size={32} className="text-white" />
            </div>
          </div>

          {/* Bottom price */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-8">
            <div className="text-center">
              <span className="text-brand-400 font-bold text-xl">{formatCurrency(pack.price)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden mb-6">

        {/* Info */}
        <div className="p-4">
          {pack.description && (
            <p className="text-gray-400 text-sm mb-4">{pack.description}</p>
          )}

          {/* Creator info */}
          {pack.creator && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-dark-700/50 rounded-lg">
              {pack.creator.avatarUrl && (
                <img
                  src={resolveMediaUrl(pack.creator.avatarUrl) || ''}
                  alt={pack.creator.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-white">{pack.creator.displayName}</span>
                  {pack.creator.verified && (
                    <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20" />
                  )}
                </div>
                <span className="text-sm text-gray-400">@{pack.creator.username}</span>
              </div>
            </div>
          )}

          {/* Purchase button */}
          <Button
            onClick={handlePurchase}
            className="w-full"
            size="lg"
          >
            <Lock size={18} className="mr-2" />
            Comprar por {formatCurrency(pack.price)}
          </Button>
        </div>
      </div>

      {/* CPF Input Modal */}
      {showCpfInput && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowCpfInput(false)}>
          <div className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Comprar Pacote</h3>
            <p className="text-gray-400 text-sm">{pack.name} - {formatCurrency(pack.price)}</p>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Seu CPF <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                  const formatted = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                  setCpf(formatted);
                }}
                placeholder="000.000.000-00"
                className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowCpfInput(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleCreatePayment} isLoading={isCreatingPayment} className="flex-1">
                Pagar com PIX
              </Button>
            </div>
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
        title="Comprar Pacote"
        description={`Pague para acessar ${pack.name}`}
      />
    </div>
  );
}

export default PackView;
