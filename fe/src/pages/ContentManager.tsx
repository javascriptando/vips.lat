import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Heart, MessageCircle, Eye, DollarSign, Lock, Image as ImageIcon, Video, Upload, Trash2, Play, Layers, GripVertical, LockKeyhole, Unlock, X, Camera, Clock } from 'lucide-react';
import { Card, Button, Badge, ResponsiveModal } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber, resolveMediaUrl } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useChunkedUpload, formatFileSize } from '@/hooks/useChunkedUpload';
import { toast } from 'sonner';
import type { Content, ContentMedia } from '@/types';

type Visibility = 'public' | 'subscribers' | 'ppv';

// Media item for carousel creation with per-item PPV support
interface MediaPreviewItem {
  id: string;
  file: File;
  url: string;
  type: 'image' | 'video';
  order: number;
  isPPV: boolean;
  ppvPrice: number; // Individual PPV price for this item (in cents)
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Draggable Media Item Component for Carousel Editor
function DraggableMediaItem({
  item,
  index,
  onRemove,
  onTogglePPV,
  onPriceChange,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isDropTarget,
}: {
  item: MediaPreviewItem;
  index: number;
  onRemove: () => void;
  onTogglePPV: () => void;
  onPriceChange: (price: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  isDragging: boolean;
  isDropTarget: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
      className={`relative bg-dark-700 rounded-xl overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isDropTarget ? 'border-brand-500 scale-105' : 'border-dark-600'}`}
    >
      {/* Order badge */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/70 rounded-lg px-2 py-1 backdrop-blur-sm">
        <GripVertical size={14} className="text-gray-400" />
        <span className="text-white text-xs font-bold">{index + 1}</span>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 z-10 p-1.5 bg-red-500/90 rounded-lg hover:bg-red-600 transition-colors"
      >
        <X size={14} className="text-white" />
      </button>

      {/* Media preview */}
      <div className="aspect-square">
        {item.type === 'video' ? (
          <div className="relative w-full h-full bg-black">
            <video src={item.url} className="w-full h-full object-cover" muted />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="p-3 bg-black/50 rounded-full backdrop-blur-sm">
                <Play size={20} className="text-white fill-white" />
              </div>
            </div>
          </div>
        ) : (
          <img src={item.url} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      {/* PPV Controls */}
      <div className="p-3 space-y-2 bg-dark-800">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePPV();
          }}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            item.isPPV
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-dark-700 text-gray-400 border border-dark-600 hover:border-dark-500'
          }`}
        >
          {item.isPPV ? (
            <>
              <LockKeyhole size={14} />
              PPV Ativo
            </>
          ) : (
            <>
              <Unlock size={14} />
              Grátis
            </>
          )}
        </button>

        {item.isPPV && (
          <div className="relative">
            <input
              type="text"
              value={formatCurrency(item.ppvPrice)}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                onPriceChange(parseInt(raw) || 0);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm font-bold focus:outline-none focus:border-amber-500 text-center"
              placeholder="R$ 0,00"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Thumbnail for grid - shows video icon overlay for videos
function MediaThumbnail({ media }: { media: ContentMedia }) {
  const url = resolveMediaUrl(media.thumbnailUrl || media.url) || '';

  return (
    <div className="relative w-full h-full">
      {media.type === 'video' ? (
        <>
          <video
            src={url}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
              <Play size={24} className="text-white fill-white" />
            </div>
          </div>
        </>
      ) : (
        <img src={url} alt="" className="w-full h-full object-cover" />
      )}
    </div>
  );
}


export function ContentManager() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { creator } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [text, setText] = useState('');
  const [storyText, setStoryText] = useState('');
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('subscribers');
  const [_ppvPrice, _setPpvPrice] = useState(990); // Reserved for future PPV pricing UI
  const [mediaItems, setMediaItems] = useState<MediaPreviewItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);

  // Chunked upload hook with progress
  const chunkedUpload = useChunkedUpload({
    onError: (error) => toast.error(error),
  });

  const { data: content, isLoading } = useQuery({
    queryKey: ['myContent', creator?.id],
    queryFn: () => api.getCreatorContent(creator!.id),
    enabled: !!creator?.id,
  });

  // Handle publish: upload files with chunks, then create content
  const handlePublish = useCallback(async () => {
    if (mediaItems.length === 0 && !text) return;

    try {
      setIsCreatingPost(true);

      // Sort media items by order
      const sortedItems = [...mediaItems].sort((a, b) => a.order - b.order);

      // Upload all files using chunked upload
      const files = sortedItems.map(item => item.file);
      const uploadedFiles = await chunkedUpload.upload(files);

      if (uploadedFiles.length === 0 && files.length > 0) {
        // Upload was cancelled or failed
        setIsCreatingPost(false);
        return;
      }

      // Map uploaded files with PPV metadata
      const mediaData = uploadedFiles.map((file, index) => ({
        ...file,
        isPPV: sortedItems[index]?.isPPV || false,
        ppvPrice: sortedItems[index]?.isPPV ? sortedItems[index].ppvPrice : undefined,
      }));

      // Create content with uploaded media
      await api.createContentWithMedia({
        type: 'post',
        visibility,
        text: text || undefined,
        media: mediaData,
      });

      queryClient.invalidateQueries({ queryKey: ['myContent'] });
      toast.success('Post criado com sucesso!');
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar post');
    } finally {
      setIsCreatingPost(false);
    }
  }, [mediaItems, text, visibility, chunkedUpload, queryClient]);

  const deletePost = useMutation({
    mutationFn: (id: string) => api.deleteContent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myContent'] });
      toast.success('Post removido!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = useCallback(() => {
    setText('');
    setVisibility('subscribers');
    setMediaItems([]);
    setDraggedIndex(null);
    setDropTargetIndex(null);
    setIsCreatingPost(false);
    chunkedUpload.reset();
    setShowCreateModal(false);
  }, [chunkedUpload]);

  // Story functions
  const resetStoryForm = useCallback(() => {
    setStoryText('');
    setStoryFile(null);
    setStoryPreviewUrl(null);
    setIsCreatingStory(false);
    setShowStoryModal(false);
  }, []);

  const handleStoryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast.error('Apenas imagens e vídeos são permitidos');
      return;
    }

    setStoryFile(file);
    const url = URL.createObjectURL(file);
    setStoryPreviewUrl(url);
  };

  const handleCreateStory = async () => {
    if (!storyFile) {
      toast.error('Selecione uma imagem ou vídeo');
      return;
    }

    try {
      setIsCreatingStory(true);
      await api.createStory(storyFile, storyText || undefined);
      toast.success('Story criado! Expira em 24 horas.');
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      resetStoryForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar story');
    } finally {
      setIsCreatingStory(false);
    }
  };

  // Calculate total file size for display
  const totalFileSize = mediaItems.reduce((acc, item) => acc + item.file.size, 0);

  // Check if currently uploading
  const isUploading = chunkedUpload.isUploading || isCreatingPost;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    selectedFiles.forEach((file) => {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItem: MediaPreviewItem = {
          id: generateId(),
          file,
          url: reader.result as string,
          type: isVideo ? 'video' : 'image',
          order: mediaItems.length + 1,
          isPPV: false,
          ppvPrice: 990, // Default price
        };
        setMediaItems((prev) => [...prev, { ...newItem, order: prev.length }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeMediaItem = (id: string) => {
    setMediaItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      // Reorder remaining items
      return filtered.map((item, index) => ({ ...item, order: index }));
    });
  };

  const toggleMediaPPV = (id: string) => {
    setMediaItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isPPV: !item.isPPV } : item
      )
    );
  };

  const updateMediaPrice = (id: string, price: number) => {
    setMediaItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ppvPrice: price } : item
      )
    );
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDropTargetIndex(null);
      return;
    }

    setMediaItems((prev) => {
      const items = [...prev];
      const [draggedItem] = items.splice(draggedIndex, 1);
      items.splice(dropIndex, 0, draggedItem);
      // Update order property for all items
      return items.map((item, index) => ({ ...item, order: index }));
    });

    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const posts = content?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Meu Conteúdo</h1>
          <p className="text-gray-400">Gerencie seus posts e mídias.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowStoryModal(true)} className="flex items-center gap-2">
            <Camera size={20} /> Story
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
            <Plus size={20} /> Novo Post
          </Button>
        </div>
      </header>

      {/* Story hidden input */}
      <input
        type="file"
        ref={storyInputRef}
        onChange={handleStoryFileChange}
        accept="image/*,video/*"
        className="hidden"
      />

      {/* Create Story Modal */}
      <ResponsiveModal
        open={showStoryModal}
        onClose={isCreatingStory ? () => {} : resetStoryForm}
        title="Criar Story"
        size="md"
        showCloseButton={!isCreatingStory}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={resetStoryForm} disabled={isCreatingStory}>
              Cancelar
            </Button>
            <Button onClick={handleCreateStory} isLoading={isCreatingStory} disabled={!storyFile}>
              Publicar Story
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Story preview */}
          {storyPreviewUrl ? (
            <div className="relative aspect-[9/16] max-h-[400px] mx-auto rounded-xl overflow-hidden bg-dark-900">
              {storyFile?.type.startsWith('video/') ? (
                <video
                  src={storyPreviewUrl}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  muted
                />
              ) : (
                <img
                  src={storyPreviewUrl}
                  alt="Story preview"
                  className="w-full h-full object-contain"
                />
              )}
              <button
                onClick={() => {
                  setStoryFile(null);
                  setStoryPreviewUrl(null);
                }}
                className="absolute top-2 right-2 p-2 bg-red-500/80 rounded-full hover:bg-red-600"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => storyInputRef.current?.click()}
              className="w-full aspect-[9/16] max-h-[400px] mx-auto rounded-xl border-2 border-dashed border-dark-600 hover:border-brand-500 transition-colors flex flex-col items-center justify-center gap-4 text-gray-400 hover:text-brand-500"
            >
              <div className="p-4 bg-dark-700 rounded-full">
                <Camera size={32} />
              </div>
              <div className="text-center">
                <p className="font-medium">Adicionar foto ou vídeo</p>
                <p className="text-sm text-gray-500">Clique para selecionar</p>
              </div>
            </button>
          )}

          {/* Story text (optional) */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">
              Texto (opcional)
            </label>
            <input
              type="text"
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Adicione uma legenda..."
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-brand-500"
              maxLength={200}
            />
          </div>

          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Clock size={16} />
            <span>Stories expiram automaticamente após 24 horas</span>
          </div>
        </div>
      </ResponsiveModal>

      {/* Create Post Modal */}
      <ResponsiveModal
        open={showCreateModal}
        onClose={isUploading ? () => {} : resetForm}
        title={isUploading ? 'Enviando post...' : 'Criar Novo Post'}
        size="xl"
        showCloseButton={!isUploading}
        footer={
          isUploading ? (
            <div className="space-y-4">
              {/* Per-file progress */}
              {chunkedUpload.progress.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {chunkedUpload.progress.map((file, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 truncate max-w-[200px]">{file.fileName}</span>
                        <span className={`font-medium ${
                          file.status === 'complete' ? 'text-green-500' :
                          file.status === 'error' ? 'text-red-500' :
                          file.status === 'uploading' ? 'text-brand-500' : 'text-gray-500'
                        }`}>
                          {file.status === 'complete' ? '✓' :
                           file.status === 'error' ? '✗' :
                           file.status === 'uploading' ? `${file.progress}%` : 'Aguardando'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            file.status === 'complete' ? 'bg-green-500' :
                            file.status === 'error' ? 'bg-red-500' :
                            'bg-gradient-to-r from-brand-500 to-purple-500'
                          }`}
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Overall Progress Bar */}
              <div className="relative">
                <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${chunkedUpload.overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Progress Info */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span>
                    {chunkedUpload.overallProgress < 100
                      ? `Enviando ${formatFileSize(totalFileSize)}...`
                      : 'Finalizando...'}
                  </span>
                </div>
                <span className="text-brand-500 font-bold text-lg">{chunkedUpload.overallProgress}%</span>
              </div>

              {/* Cancel Button */}
              <Button
                variant="secondary"
                onClick={() => {
                  chunkedUpload.cancel();
                  setIsCreatingPost(false);
                }}
                className="w-full"
              >
                Cancelar Upload
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* File Size Info */}
              {mediaItems.length > 0 && (
                <div className="text-xs text-gray-500 text-center">
                  {mediaItems.length} {mediaItems.length === 1 ? 'arquivo' : 'arquivos'} • {formatFileSize(totalFileSize)}
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={!text && mediaItems.length === 0}
                  className="flex-1"
                >
                  Publicar
                </Button>
              </div>
            </div>
          )
        }
      >
        <div className="space-y-5">
          {/* Text */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Descrição</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="O que você quer compartilhar?"
              rows={3}
              className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all resize-none"
            />
          </div>

          {/* File Upload & Carousel Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Mídia</label>
              {mediaItems.length > 0 && (
                <span className="text-xs text-gray-500">
                  Arraste para reordenar • {mediaItems.length} {mediaItems.length === 1 ? 'item' : 'itens'}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Upload Area */}
            {mediaItems.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-dark-600 rounded-xl p-8 text-center hover:border-brand-500 transition-colors"
              >
                <Upload size={40} className="mx-auto mb-3 text-gray-500" />
                <p className="text-gray-300 font-medium">Clique para adicionar fotos ou vídeos</p>
                <p className="text-gray-500 text-sm mt-1">Adicione múltiplos arquivos para criar um carrossel</p>
              </button>
            ) : (
              <div className="space-y-4">
                {/* Carousel Editor Grid - responsive */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {mediaItems.map((item, index) => (
                    <DraggableMediaItem
                      key={item.id}
                      item={item}
                      index={index}
                      onRemove={() => removeMediaItem(item.id)}
                      onTogglePPV={() => toggleMediaPPV(item.id)}
                      onPriceChange={(price) => updateMediaPrice(item.id, price)}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      isDragging={draggedIndex === index}
                      isDropTarget={dropTargetIndex === index}
                    />
                  ))}
                </div>

                {/* Add More Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-dark-600 rounded-xl p-4 text-center hover:border-brand-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={20} className="text-gray-500" />
                  <span className="text-gray-400 text-sm">Adicionar mais mídia</span>
                </button>

                {/* PPV Summary */}
                {mediaItems.some(item => item.isPPV) && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <LockKeyhole size={18} />
                      <span className="font-medium">
                        {mediaItems.filter(item => item.isPPV).length} item(s) com PPV individual
                      </span>
                    </div>
                    <p className="text-amber-400/70 text-sm mt-1">
                      Usuários precisarão pagar para desbloquear cada item marcado
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visibility - Who can see this post exists */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">
              Quem pode ver este post?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`px-4 py-4 rounded-xl text-sm font-medium transition-colors text-left ${
                  visibility === 'public'
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <div className="font-semibold text-base">Público</div>
                <div className="text-xs opacity-80 mt-1">Aparece no Explorar para todos</div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('subscribers')}
                className={`px-4 py-4 rounded-xl text-sm font-medium transition-colors text-left ${
                  visibility === 'subscribers'
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <div className="font-semibold text-base">Assinantes</div>
                <div className="text-xs opacity-80 mt-1">Apenas para quem assina</div>
              </button>
            </div>
            <p className="text-[11px] text-gray-600 mt-2 italic">
              Dica: Marque itens individuais como PPV usando o botão em cada mídia
            </p>
          </div>
        </div>
      </ResponsiveModal>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-dark-800 rounded-2xl aspect-[4/3] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post: Content) => (
            <Card key={post.id} padding="none" className="overflow-hidden group">
              <div
                className="relative aspect-video cursor-pointer"
                onClick={() => navigate(`/post/${post.id}`)}
              >
                {post.media?.[0] ? (
                  <MediaThumbnail media={post.media[0]} />
                ) : (
                  <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                    <ImageIcon size={32} className="text-dark-500" />
                  </div>
                )}

                {/* Multiple media indicator */}
                {post.media.length > 1 && (
                  <div className="absolute top-2 left-12 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-md flex items-center gap-1">
                    <Layers size={12} /> {post.media.length}
                  </div>
                )}

                <div className="absolute top-2 right-2 flex gap-2">
                  {post.visibility === 'ppv' && (
                    <div className="bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-md flex items-center gap-1">
                      <Lock size={12} /> {formatCurrency(post.ppvPrice || 0)}
                    </div>
                  )}
                  <Badge
                    variant={post.visibility === 'public' ? 'success' : post.visibility === 'subscribers' ? 'warning' : 'default'}
                  >
                    {post.visibility === 'public' ? 'Público' : post.visibility === 'subscribers' ? 'Assinantes' : 'PPV'}
                  </Badge>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Tem certeza que deseja excluir este post?')) {
                      deletePost.mutate(post.id);
                    }
                  }}
                  className="absolute top-2 left-2 p-2 bg-red-500/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} className="text-white" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-300 line-clamp-2 mb-4">{post.text || 'Sem descrição'}</p>
                <div className="flex items-center justify-between text-xs text-gray-400 border-t border-dark-700 pt-3">
                  <span className="flex items-center gap-1">
                    <Heart size={14} /> {formatNumber(post.likeCount || 0)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={14} /> {formatNumber(post.commentCount || 0)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye size={14} /> {formatNumber(post.viewCount || 0)}
                  </span>
                  <span className="flex items-center gap-1 font-bold text-green-500">
                    <DollarSign size={14} /> {formatCurrency((post as any).revenue || 0)}
                  </span>
                </div>
              </div>
            </Card>
          ))}

          {posts.length === 0 && (
            <Card className="col-span-full text-center py-12">
              <Video size={48} className="mx-auto mb-4 text-dark-500" />
              <p className="text-gray-400">Você ainda não tem conteúdo.</p>
              <Button onClick={() => setShowCreateModal(true)} className="mt-4">
                <Plus size={20} /> Criar Primeiro Post
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
