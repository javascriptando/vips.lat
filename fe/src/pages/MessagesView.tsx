import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Lock,
  AlertCircle,
  Image,
  X,
  DollarSign,
  Layers,
  Unlock,
  Play,
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { PaymentModal } from '@/components/PaymentModal';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { api } from '@/lib/api';
import { formatRelativeTime, formatCurrency, resolveMediaUrl } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { PaymentResponse } from '@/types';

type Conversation = {
  id: string;
  creatorId?: string;
  userId?: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  isBlocked: boolean;
  creatorDisplayName?: string;
  creatorUsername?: string;
  creatorAvatarUrl?: string | null;
  creatorVerified?: boolean;
  userName?: string | null;
  userUsername?: string;
  userAvatarUrl?: string | null;
};

type MessageType = {
  id: string;
  senderId: string;
  text: string | null;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  thumbnailUrl?: string | null;
  ppvPrice: number | null;
  isPurchased: boolean;
  isRead: boolean;
  createdAt: string;
  senderName: string | null;
  senderUsername: string;
  senderAvatarUrl: string | null;
  pack?: {
    id: string;
    name: string;
    coverUrl: string | null;
    price: number;
    mediaCount: number;
  } | null;
  packPurchased?: boolean;
};

type PackType = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  price: number;
  mediaCount: number;
  visibility: 'public' | 'private';
};

function UnifiedConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: (Conversation & { isCreatorConvo?: boolean })[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <MessageCircle size={48} className="text-dark-500 mb-4" />
        <p className="text-gray-400">Nenhuma conversa ainda</p>
        <Link to="/explore" className="text-brand-500 hover:underline mt-2">
          Explorar criadores
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-dark-700">
      {conversations.map((conv) => {
        const isCreatorConvo = conv.isCreatorConvo;
        const name = isCreatorConvo
          ? conv.userName || conv.userUsername
          : conv.creatorDisplayName;
        const avatar = isCreatorConvo ? conv.userAvatarUrl : conv.creatorAvatarUrl;
        const isVerified = !isCreatorConvo && conv.creatorVerified;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full p-4 flex items-center gap-3 hover:bg-dark-700/50 transition-colors text-left ${
              selectedId === conv.id ? 'bg-dark-700' : ''
            }`}
          >
            <Avatar src={avatar} name={name || ''} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-white truncate">{name}</span>
                {isVerified && <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20" />}
                {conv.isBlocked && <Ban size={14} className="text-red-500" />}
              </div>
              <p className="text-sm text-gray-500 truncate">
                {conv.lastMessagePreview || 'Inicie uma conversa'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{formatRelativeTime(conv.lastMessageAt)}</p>
              {conv.unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-brand-500 text-white text-xs rounded-full mt-1">
                  {conv.unreadCount}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Pack Selector Modal
function PackSelectorModal({
  packs,
  onSelect,
  onClose,
}: {
  packs: PackType[];
  onSelect: (pack: PackType) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-dark-800 rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h3 className="text-lg font-bold text-white">Selecionar Pacote</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[50vh] p-4 space-y-3">
          {packs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Layers size={32} className="mx-auto mb-2 opacity-50" />
              <p>Você não tem pacotes criados</p>
              <Link to="/creator/dashboard" className="text-brand-500 hover:underline text-sm">
                Criar pacote
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => onSelect(pack)}
                  className="group"
                >
                  {/* Mini Gift Box */}
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-brand-600/20 via-dark-800 to-dark-900 border-2 border-brand-500/30 hover:border-brand-500/60 transition-all">
                    {/* Gift ribbon - vertical */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-full bg-gradient-to-b from-brand-500/40 via-brand-500/20 to-brand-500/40" />
                    {/* Gift ribbon - horizontal */}
                    <div className="absolute top-1/3 left-0 w-full h-3 bg-gradient-to-r from-brand-500/40 via-brand-500/20 to-brand-500/40" />
                    {/* Ribbon bow */}
                    <div className="absolute top-[calc(33%-8px)] left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-brand-500/30 border border-brand-500/50 flex items-center justify-center">
                      <Layers size={10} className="text-brand-400" />
                    </div>

                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 pt-10">
                      <h3 className="font-bold text-white text-center text-[10px] leading-tight line-clamp-2">{pack.name}</h3>
                      <p className="text-[9px] text-gray-400 mt-0.5">{pack.mediaCount} itens</p>
                    </div>

                    {/* Price */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                      <span className="text-brand-400 font-bold text-xs block text-center">{formatCurrency(pack.price)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatView({
  conversation,
  onBack,
  isCreatorView,
}: {
  conversation: Conversation;
  onBack: () => void;
  isCreatorView: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [canSend, setCanSend] = useState<boolean | null>(null);
  const [cantSendReason, setCantSendReason] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Creator-only states for sending media/pack/ppv
  const [attachedMedia, setAttachedMedia] = useState<{ file: File; url: string; type: 'image' | 'video' } | null>(null);
  const [isPPV, setIsPPV] = useState(false);
  const [ppvPrice, setPpvPrice] = useState(990); // Default R$9.90
  const [showPackSelector, setShowPackSelector] = useState(false);
  const [selectedPack, setSelectedPack] = useState<PackType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User-only states for purchasing
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
  const [purchaseType, setPurchaseType] = useState<'ppv' | 'pack'>('ppv');
  const [purchaseMessageId, setPurchaseMessageId] = useState<string | null>(null);
  const [purchasePackId, setPurchasePackId] = useState<string | null>(null);
  const [showCpfInput, setShowCpfInput] = useState(false);
  const [cpf, setCpf] = useState('');
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  // Media viewer state
  const [viewerMedia, setViewerMedia] = useState<MediaPost | null>(null);

  const name = isCreatorView
    ? conversation.userName || conversation.userUsername
    : conversation.creatorDisplayName;
  const username = isCreatorView ? conversation.userUsername : conversation.creatorUsername;
  const avatar = isCreatorView ? conversation.userAvatarUrl : conversation.creatorAvatarUrl;

  // Fetch creator's packs (only for creator view)
  const { data: packsData } = useQuery({
    queryKey: ['myPacksAll'],
    queryFn: () => api.getMyPacksAll(),
    enabled: isCreatorView,
  });
  const myPacks = (packsData?.packs || []) as PackType[];

  // Check if user can send messages
  useEffect(() => {
    if (isCreatorView) {
      setCanSend(true);
      return;
    }
    if (!conversation.creatorId) {
      setCanSend(false);
      return;
    }

    api.canSendMessage(conversation.creatorId).then((result) => {
      setCanSend(result.allowed);
      if (!result.allowed) {
        setCantSendReason(result.reason || 'Você precisa ser assinante para enviar mensagens');
      }
    }).catch(() => {
      setCanSend(false);
      setCantSendReason('Erro ao verificar permissão');
    });
  }, [conversation.creatorId, isCreatorView]);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () => api.getMessages(conversation.id),
    refetchInterval: 5000,
  });

  const messages = (data?.messages || []) as MessageType[];

  // Mark as read when opening
  useEffect(() => {
    if (conversation.unreadCount > 0) {
      api.markConversationRead(conversation.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['creatorConversations'] });
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      });
    }
  }, [conversation.id, conversation.unreadCount, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      toast.error('Apenas imagens e vídeos são permitidos');
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setAttachedMedia({ file, url, type: isVideo ? 'video' : 'image' });
    setSelectedPack(null); // Clear pack if media is selected
  };

  // Handle pack selection
  const handlePackSelect = (pack: PackType) => {
    setSelectedPack(pack);
    setAttachedMedia(null); // Clear media if pack is selected
    setIsPPV(false);
    setShowPackSelector(false);
  };

  // Clear attachments
  const clearAttachments = () => {
    if (attachedMedia) {
      URL.revokeObjectURL(attachedMedia.url);
    }
    setAttachedMedia(null);
    setSelectedPack(null);
    setIsPPV(false);
    setPpvPrice(990);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (isCreatorView) {
        // Creator sending - may have media, PPV, or pack
        if (attachedMedia) {
          setIsUploading(true);
          try {
            // Upload the file first
            const formData = new FormData();
            formData.append('file', attachedMedia.file);
            const uploadResult = await api.uploadMedia(formData);

            // Then send message with media
            return api.sendMessageAsCreatorWithMedia(conversation.id, {
              text: message.trim() || undefined,
              mediaUrl: uploadResult.url,
              mediaType: attachedMedia.type,
              thumbnailUrl: uploadResult.thumbnailUrl || undefined,
              ppvPrice: isPPV ? ppvPrice : undefined,
            });
          } finally {
            setIsUploading(false);
          }
        } else if (selectedPack) {
          // Send pack
          return api.sendMessageAsCreatorWithMedia(conversation.id, {
            text: message.trim() || undefined,
            packId: selectedPack.id,
          });
        } else {
          // Text only
          return api.sendMessageAsCreator(conversation.id, message);
        }
      } else {
        // User sending - text only
        return api.sendMessage(conversation.creatorId!, message);
      }
    },
    onSuccess: () => {
      setMessage('');
      clearAttachments();
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['creatorConversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => api.toggleBlockConversation(conversation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatorConversations'] });
      toast.success(conversation.isBlocked ? 'Conversa desbloqueada' : 'Conversa bloqueada');
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const hasContent = message.trim() || attachedMedia || selectedPack;
    if (!hasContent) return;
    sendMutation.mutate();
  };

  // Handle PPV/Pack purchase
  const handleUnlock = (msg: MessageType, type: 'ppv' | 'pack') => {
    setPurchaseType(type);
    setPurchaseMessageId(msg.id);
    setPurchasePackId(msg.pack?.id || null);
    setShowCpfInput(true);
  };

  const handleCreatePayment = async () => {
    if (!cpf || cpf.replace(/\D/g, '').length < 11) {
      toast.error('CPF é obrigatório');
      return;
    }
    setIsCreatingPayment(true);
    try {
      let response: PaymentResponse;
      if (purchaseType === 'ppv' && purchaseMessageId) {
        response = await api.payMessagePPV(purchaseMessageId, cpf.replace(/\D/g, ''));
      } else if (purchaseType === 'pack' && purchasePackId) {
        response = await api.payPack(purchasePackId, purchaseMessageId || undefined, cpf.replace(/\D/g, ''));
      } else {
        throw new Error('Dados de pagamento inválidos');
      }
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
    setPurchaseMessageId(null);
    setPurchasePackId(null);
    toast.success('Conteúdo desbloqueado!');
    queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-dark-700 flex items-center gap-3">
        <button onClick={onBack} className="lg:hidden p-2 hover:bg-dark-700 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <Link
          to={isCreatorView ? '#' : `/creator/${username}`}
          className="flex items-center gap-3 flex-1"
        >
          <Avatar src={avatar} name={name || ''} />
          <div>
            <p className="font-semibold text-white">{name}</p>
            <p className="text-sm text-gray-500">@{username}</p>
          </div>
        </Link>
        {isCreatorView && (
          <button
            onClick={() => blockMutation.mutate()}
            disabled={blockMutation.isPending}
            className={`p-2 rounded-lg transition-colors ${
              conversation.isBlocked
                ? 'bg-red-500/10 text-red-500'
                : 'hover:bg-dark-700 text-gray-400'
            }`}
            title={conversation.isBlocked ? 'Desbloquear' : 'Bloquear'}
          >
            <Ban size={20} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>Nenhuma mensagem ainda</p>
            <p className="text-sm">Envie a primeira mensagem!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            const hasPPV = msg.ppvPrice && msg.ppvPrice > 0 && !msg.isPurchased;

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl overflow-hidden ${
                    isMe
                      ? 'bg-brand-500 text-white rounded-br-sm'
                      : 'bg-dark-700 text-gray-100 rounded-bl-sm'
                  }`}
                >
                  {/* Pack attachment - Gift Box Style */}
                  {msg.pack && (
                    <button
                      onClick={() => {
                        if (msg.packPurchased || isMe) {
                          navigate(`/pack/${msg.pack!.id}`);
                        } else if (!isMe) {
                          handleUnlock(msg, 'pack');
                        }
                      }}
                      className="w-full group"
                    >
                      <div className="relative aspect-square max-w-[200px] mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-brand-600/20 via-dark-800 to-dark-900 border-2 border-brand-500/30 hover:border-brand-500/60 transition-all shadow-lg hover:shadow-brand-500/20 hover:scale-[1.02] mt-4">
                        {/* Gift ribbon - vertical */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-full bg-gradient-to-b from-brand-500/40 via-brand-500/20 to-brand-500/40" />
                        {/* Gift ribbon - horizontal */}
                        <div className="absolute top-1/3 left-0 w-full h-4 bg-gradient-to-r from-brand-500/40 via-brand-500/20 to-brand-500/40" />

                        {/* Content */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 pt-12">
                          <h3 className="font-bold text-white text-center text-xs leading-tight line-clamp-2 mb-1">{msg.pack.name}</h3>
                          <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                            <Layers size={10} />
                            <span>{msg.pack.mediaCount} itens</span>
                          </div>
                        </div>
                      
                        {/* Purchased badge */}
                        {msg.packPurchased && !isMe && (
                          <div className="absolute top-2 left-2">
                            <span className="bg-green-500/90 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                              ✓ Comprado
                            </span>
                          </div>
                        )}

                        {/* Lock overlay for unpurchased */}
                        {!msg.packPurchased && !isMe && (
                          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                            <Lock size={20} className="text-white mb-1" />
                            <span className="text-white font-bold text-sm">{formatCurrency(msg.pack.price)}</span>
                          </div>
                        )}

                        {/* Bottom info */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4">
                          <div className="flex items-center justify-center">
                            <span className="text-brand-400 font-bold text-sm">{formatCurrency(msg.pack.price)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Media with optional PPV */}
                  {msg.mediaUrl && (
                    <div className="relative">
                      {hasPPV && !isMe ? (
                        <div className="aspect-video bg-dark-800 flex flex-col items-center justify-center p-4">
                          <Lock size={32} className="mb-2 opacity-70" />
                          <p className="text-sm mb-2">Conteúdo exclusivo</p>
                          <span className="font-bold text-brand-400 mb-3">{formatCurrency(msg.ppvPrice!)}</span>
                          <button
                            onClick={() => handleUnlock(msg, 'ppv')}
                            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
                          >
                            <Unlock size={16} />
                            Desbloquear
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            // Use the message sender's info for the viewer
                            const senderInfo = {
                              id: msg.senderId,
                              displayName: msg.senderName || msg.senderUsername,
                              username: msg.senderUsername,
                              avatarUrl: msg.senderAvatarUrl || undefined,
                              isVerified: false,
                            };

                            setViewerMedia({
                              id: msg.id,
                              media: [{
                                url: msg.mediaUrl!,
                                type: msg.mediaType || 'image',
                                thumbnailUrl: msg.thumbnailUrl || undefined,
                                hasAccess: true,
                              }],
                              hasAccess: true,
                              visibility: 'private',
                              creator: senderInfo,
                              text: msg.text || undefined,
                              likeCount: 0,
                              commentCount: 0,
                            });
                          }}
                          className="relative block w-full group cursor-pointer overflow-hidden rounded-lg"
                        >
                          {msg.mediaType === 'video' ? (
                            <>
                              {msg.thumbnailUrl ? (
                                <img
                                  src={resolveMediaUrl(msg.thumbnailUrl) || ''}
                                  alt=""
                                  className="w-full max-h-52 object-cover"
                                />
                              ) : (
                                <video
                                  src={resolveMediaUrl(msg.mediaUrl) || ''}
                                  className="w-full max-h-52 object-cover"
                                  muted
                                  playsInline
                                />
                              )}
                              {/* Play button overlay for videos */}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Play size={24} className="text-white fill-white ml-1" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <img
                              src={resolveMediaUrl(msg.mediaUrl) || ''}
                              alt=""
                              className="w-full max-h-52 object-cover group-hover:opacity-90 transition-opacity"
                            />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Text content */}
                  {msg.text && (
                    <div className="px-4 py-2">
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className={`px-4 pb-2 ${!msg.text && !msg.mediaUrl && !msg.pack ? 'pt-2' : ''}`}>
                    <p className={`text-xs ${isMe ? 'text-white/70' : 'text-gray-500'}`}>
                      {formatRelativeTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {conversation.isBlocked && !isCreatorView ? (
        <div className="p-4 border-t border-dark-700 text-center">
          <div className="flex items-center justify-center gap-2 text-red-400">
            <Lock size={16} />
            <span className="text-sm">O criador bloqueou esta conversa</span>
          </div>
        </div>
      ) : canSend === false && !isCreatorView ? (
        <div className="p-4 border-t border-dark-700 text-center">
          <div className="flex items-center justify-center gap-2 text-yellow-400">
            <AlertCircle size={16} />
            <span className="text-sm">{cantSendReason}</span>
          </div>
          <Link
            to={`/creator/${conversation.creatorUsername}`}
            className="text-brand-500 text-sm hover:underline mt-1 inline-block"
          >
            Assinar para enviar mensagens
          </Link>
        </div>
      ) : (
        <div className="border-t border-dark-700">
          {/* Attachment Preview (creator only) */}
          {isCreatorView && (attachedMedia || selectedPack) && (
            <div className="p-3 bg-dark-800/50 border-b border-dark-700">
              <div className="flex items-center gap-3">
                {attachedMedia && (
                  <>
                    {attachedMedia.type === 'video' ? (
                      <video src={attachedMedia.url} className="w-14 h-14 object-cover rounded-lg" />
                    ) : (
                      <img src={attachedMedia.url} alt="" className="w-14 h-14 object-cover rounded-lg" />
                    )}
                    <div className="flex-1 flex items-center gap-3">
                      {/* PPV Toggle - styled radio buttons */}
                      <div className="flex rounded-lg overflow-hidden border border-dark-600">
                        <button
                          type="button"
                          onClick={() => setIsPPV(false)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            !isPPV
                              ? 'bg-brand-500 text-white'
                              : 'bg-dark-700 text-gray-400 hover:text-white'
                          }`}
                        >
                          Grátis
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPPV(true)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            isPPV
                              ? 'bg-green-500 text-white'
                              : 'bg-dark-700 text-gray-400 hover:text-white'
                          }`}
                        >
                          PPV
                        </button>
                      </div>
                      {isPPV && (
                        <div className="flex items-center gap-1 bg-dark-700 rounded-lg px-2 py-1 border border-dark-600">
                          <span className="text-xs text-gray-400">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={(ppvPrice / 100).toFixed(2).replace('.', ',')}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, '');
                              const cents = parseInt(v || '0', 10);
                              setPpvPrice(cents);
                            }}
                            className="w-16 bg-transparent text-sm text-white focus:outline-none"
                            placeholder="9,90"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
                {selectedPack && (
                  <>
                    {/* Mini Gift Box Preview */}
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-brand-600/20 via-dark-800 to-dark-900 border border-brand-500/30">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-full bg-gradient-to-b from-brand-500/40 via-brand-500/20 to-brand-500/40" />
                      <div className="absolute top-1/3 left-0 w-full h-2 bg-gradient-to-r from-brand-500/40 via-brand-500/20 to-brand-500/40" />
                      <div className="absolute top-[calc(33%-6px)] left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-brand-500/30 border border-brand-500/50 flex items-center justify-center">
                        <Layers size={8} className="text-brand-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-semibold">{selectedPack.name}</p>
                      <p className="text-xs text-gray-400">{selectedPack.mediaCount} itens • {formatCurrency(selectedPack.price)}</p>
                    </div>
                  </>
                )}
                <button
                  onClick={clearAttachments}
                  className="p-1.5 bg-dark-700 hover:bg-dark-600 rounded-full text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-4">
            <div className="flex gap-2 items-end">
              {/* Creator attachment buttons */}
              {isCreatorView && (
                <div className="flex gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-gray-400 hover:text-white transition-colors"
                    title="Anexar mídia"
                  >
                    <Image size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPackSelector(true)}
                    className="p-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-gray-400 hover:text-brand-500 transition-colors"
                    title="Enviar pacote"
                  >
                    <Layers size={20} />
                  </button>
                </div>
              )}

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isCreatorView ? "Digite sua mensagem..." : "Digite sua mensagem..."}
                className="flex-1 bg-dark-700 border border-dark-600 rounded-full px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={(!message.trim() && !attachedMedia && !selectedPack) || sendMutation.isPending || isUploading}
                className="p-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-white transition-colors"
              >
                {sendMutation.isPending || isUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pack Selector Modal */}
      {showPackSelector && (
        <PackSelectorModal
          packs={myPacks}
          onSelect={handlePackSelect}
          onClose={() => setShowPackSelector(false)}
        />
      )}

      {/* CPF Input Modal */}
      {showCpfInput && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowCpfInput(false)}>
          <div className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {purchaseType === 'ppv' ? 'Desbloquear Conteúdo' : 'Comprar Pacote'}
              </h3>
              <button onClick={() => setShowCpfInput(false)} className="p-1 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

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
              <p className="text-xs text-gray-500 mt-1">Necessário para pagamentos PIX</p>
            </div>

            <Button
              onClick={handleCreatePayment}
              isLoading={isCreatingPayment}
              className="w-full"
            >
              <DollarSign size={18} className="mr-2" />
              Pagar com PIX
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
        title={purchaseType === 'ppv' ? 'Desbloquear Conteúdo' : 'Comprar Pacote'}
        description={purchaseType === 'ppv' ? 'Pague para ver este conteúdo' : 'Pague para acessar este pacote'}
      />

      {/* Media Viewer for fullscreen media */}
      {viewerMedia && (
        <MediaViewer
          post={viewerMedia}
          onClose={() => setViewerMedia(null)}
          hideInteractions
        />
      )}
    </div>
  );
}

export function MessagesView() {
  const { isCreator } = useAuth();
  const location = useLocation();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const targetCreatorId = (location.state as { creatorId?: string })?.creatorId;

  const { data: creatorConvos, isLoading: loadingCreator } = useQuery({
    queryKey: ['creatorConversations'],
    queryFn: () => api.getCreatorConversations(),
    enabled: isCreator,
  });

  const { data: userConvos, isLoading: loadingUser, refetch: refetchUserConvos } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations(),
  });

  // Combine and deduplicate conversations by ID
  // Creator conversations take priority (isCreatorConvo: true)
  type CreatorConvo = NonNullable<typeof creatorConvos>['conversations'][0] & { isCreatorConvo: boolean };
  type UserConvo = NonNullable<typeof userConvos>['conversations'][0] & { isCreatorConvo: boolean };
  type AnyConvo = CreatorConvo | UserConvo;

  const allConversations = (() => {
    const creatorConvList = (creatorConvos?.conversations || []).map(c => ({ ...c, isCreatorConvo: true as const }));
    const userConvList = (userConvos?.conversations || []).map(c => ({ ...c, isCreatorConvo: false as const }));

    // Use a Map to deduplicate by ID, creator convos take priority
    const convMap = new Map<string, AnyConvo>();

    // Add creator conversations first (they take priority)
    for (const conv of creatorConvList) {
      convMap.set(conv.id, conv);
    }

    // Add user conversations only if not already present
    for (const conv of userConvList) {
      if (!convMap.has(conv.id)) {
        convMap.set(conv.id, conv);
      }
    }

    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  })();

  const isLoading = loadingCreator || loadingUser;

  useEffect(() => {
    if (!targetCreatorId || isLoading || isCreatingConversation) return;

    const existingConvo = allConversations.find(
      c => !c.isCreatorConvo && 'creatorId' in c && c.creatorId === targetCreatorId
    );

    if (existingConvo) {
      setSelectedConversation(existingConvo);
      window.history.replaceState({}, document.title);
    } else {
      setIsCreatingConversation(true);
      api.getOrCreateConversation(targetCreatorId)
        .then((conv) => {
          refetchUserConvos().then(() => {
            setSelectedConversation({
              id: conv.id,
              creatorId: targetCreatorId,
              lastMessageAt: conv.lastMessageAt || new Date().toISOString(),
              lastMessagePreview: conv.lastMessagePreview || null,
              unreadCount: 0,
              isBlocked: false,
              creatorDisplayName: conv.creatorDisplayName,
              creatorUsername: conv.creatorUsername,
              creatorAvatarUrl: conv.creatorAvatarUrl,
              creatorVerified: conv.creatorVerified,
              isCreatorConvo: false,
            } as Conversation & { isCreatorConvo: boolean });
          });
          window.history.replaceState({}, document.title);
        })
        .catch((err) => {
          toast.error('Erro ao abrir conversa: ' + err.message);
        })
        .finally(() => {
          setIsCreatingConversation(false);
        });
    }
  }, [targetCreatorId, isLoading, allConversations, isCreatingConversation, refetchUserConvos]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-dark-700">
        <h1 className="text-xl font-bold text-white">Mensagens</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          className={`w-full lg:w-80 border-r border-dark-700 overflow-y-auto ${
            selectedConversation ? 'hidden lg:block' : ''
          }`}
        >
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-dark-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-dark-700 rounded" />
                    <div className="h-3 w-32 bg-dark-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <UnifiedConversationList
              conversations={allConversations}
              selectedId={selectedConversation?.id || null}
              onSelect={setSelectedConversation}
            />
          )}
        </div>

        <div
          className={`flex-1 ${
            selectedConversation ? '' : 'hidden lg:flex'
          } flex-col`}
        >
          {selectedConversation ? (
            <ChatView
              conversation={selectedConversation}
              onBack={() => setSelectedConversation(null)}
              isCreatorView={(selectedConversation as any).isCreatorConvo || false}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageCircle size={64} className="mx-auto text-dark-500 mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Suas Mensagens</h2>
                <p className="text-gray-500">
                  Selecione uma conversa para ver as mensagens
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
