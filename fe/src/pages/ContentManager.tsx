import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Heart, MessageCircle, Eye, Lock, Image as ImageIcon, Grid, Upload, Trash2, Play, Layers, GripVertical, LockKeyhole, Unlock, X, Camera, Clock, Globe, EyeOff } from 'lucide-react';
import { Button, Badge, ResponsiveModal } from '@/components/ui';
import { StoryViewer, type StoryCreator } from '@/components/media';
import { MediaViewer, type MediaPost } from '@/components/MediaViewer';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber, resolveMediaUrl } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useChunkedUpload, formatFileSize } from '@/hooks/useChunkedUpload';
import { toast } from 'sonner';
import type { Content, ContentMedia } from '@/types';

// Pack type from API
interface PackData {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  price: number;
  visibility: 'public' | 'private';
  salesCount: number;
  isActive: boolean;
  media: Array<{ url: string; type: 'image' | 'video'; thumbnailUrl?: string }>;
  createdAt: string;
}

// Pack media item
interface PackMediaItem {
  id: string;
  file: File;
  url: string;
  type: 'image' | 'video';
}

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
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'post' | 'story' | 'pack'; id: string } | null>(null);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [selectedPackView, setSelectedPackView] = useState<MediaPost | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);

  // Pack state
  const [showPackModal, setShowPackModal] = useState(false);
  const [packName, setPackName] = useState('');
  const [packDescription, setPackDescription] = useState('');
  const [packPrice, setPackPrice] = useState(990); // Default R$9,90
  const [packVisibility, setPackVisibility] = useState<'public' | 'private'>('public');
  const [packMediaItems, setPackMediaItems] = useState<PackMediaItem[]>([]);
  const [isCreatingPack, setIsCreatingPack] = useState(false);
  const packFileInputRef = useRef<HTMLInputElement>(null);

  // Chunked upload for packs
  const packUpload = useChunkedUpload({
    onError: (error) => toast.error(error),
  });

  // Chunked upload hook with progress (for posts)
  const chunkedUpload = useChunkedUpload({
    onError: (error) => toast.error(error),
  });

  // Chunked upload hook for stories
  const storyUpload = useChunkedUpload({
    onError: (error) => toast.error(error),
  });

  const { data: content, isLoading } = useQuery({
    queryKey: ['myContent', creator?.id],
    queryFn: () => api.getCreatorContent(creator!.id),
    enabled: !!creator?.id,
  });

  const { data: storiesData } = useQuery({
    queryKey: ['myStories'],
    queryFn: () => api.getMyStories(),
    enabled: !!creator?.id,
  });

  const myStories = storiesData?.stories || [];

  // Packs query
  const { data: packsData, isLoading: isLoadingPacks } = useQuery({
    queryKey: ['myPacks'],
    queryFn: () => api.getMyPacks(),
    enabled: !!creator?.id,
  });

  const myPacks = packsData?.data || [];

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

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['myContent'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['exploreFeed'] });
      queryClient.invalidateQueries({ queryKey: ['creatorContent'] });
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

  const deleteStory = useMutation({
    mutationFn: (id: string) => api.deleteStory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myStories'] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast.success('Story removido!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deletePack = useMutation({
    mutationFn: (id: string) => api.deletePack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPacks'] });
      toast.success('Pacote removido!');
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
    storyUpload.reset();
    setShowStoryModal(false);
  }, [storyUpload]);

  // Pack functions
  const resetPackForm = useCallback(() => {
    setPackName('');
    setPackDescription('');
    setPackPrice(990);
    setPackVisibility('public');
    setPackMediaItems([]);
    setIsCreatingPack(false);
    packUpload.reset();
    setShowPackModal(false);
  }, [packUpload]);

  const handlePackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    selectedFiles.forEach((file) => {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItem: PackMediaItem = {
          id: generateId(),
          file,
          url: reader.result as string,
          type: isVideo ? 'video' : 'image',
        };
        setPackMediaItems((prev) => [...prev, newItem]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePackMediaItem = (id: string) => {
    setPackMediaItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCreatePack = async () => {
    if (!packName.trim()) {
      toast.error('Nome do pacote é obrigatório');
      return;
    }
    if (packMediaItems.length === 0) {
      toast.error('Adicione pelo menos uma mídia ao pacote');
      return;
    }
    if (packPrice < 100) {
      toast.error('Preço mínimo é R$1,00');
      return;
    }

    try {
      setIsCreatingPack(true);

      // Upload all files
      const files = packMediaItems.map((item) => item.file);
      const uploadedFiles = await packUpload.upload(files);

      if (uploadedFiles.length === 0 && files.length > 0) {
        setIsCreatingPack(false);
        return;
      }

      // Map uploaded files to media data
      const mediaData = uploadedFiles.map((file) => ({
        path: file.path,
        url: file.url,
        type: file.type,
        size: file.size,
        mimeType: file.mimeType,
      }));

      // Create pack
      await api.createPack({
        name: packName.trim(),
        description: packDescription.trim() || undefined,
        price: packPrice,
        visibility: packVisibility,
        media: mediaData,
        coverUrl: uploadedFiles[0]?.url, // Use first media as cover
      });

      queryClient.invalidateQueries({ queryKey: ['myPacks'] });
      toast.success('Pacote criado com sucesso!');
      resetPackForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar pacote');
    } finally {
      setIsCreatingPack(false);
    }
  };

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

      // Upload file using chunked upload (same as posts)
      const uploadedFiles = await storyUpload.upload([storyFile]);

      if (uploadedFiles.length === 0) {
        // Upload was cancelled or failed
        setIsCreatingStory(false);
        return;
      }

      const uploadedFile = uploadedFiles[0];

      // Create story with pre-uploaded media
      await api.createStoryWithMedia({
        mediaUrl: uploadedFile.url,
        mediaType: uploadedFile.type,
        text: storyText || undefined,
      });

      toast.success('Story criado! Expira em 24 horas.');
      // Invalidate both stories queries
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['myStories'] });
      resetStoryForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar story');
    } finally {
      setIsCreatingStory(false);
    }
  };

  // Transform myStories to StoryCreator format for StoryViewer
  const myStoriesAsCreator = useMemo((): StoryCreator[] => {
    if (!creator || myStories.length === 0) return [];
    return [{
      id: creator.id,
      displayName: creator.displayName,
      username: creator.username,
      avatarUrl: creator.avatarUrl || null,
      isVerified: creator.isVerified || false,
      hasUnviewed: false, // Creator has seen all their own stories
      stories: myStories.map(story => ({
        id: story.id,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        thumbnailUrl: story.thumbnailUrl || null,
        text: story.text || null,
        viewCount: story.viewCount,
        expiresAt: story.expiresAt,
        createdAt: story.createdAt,
        isViewed: true, // Creator has seen all their own stories
      })),
    }];
  }, [creator, myStories]);

  const handleOpenStory = () => {
    setStoryViewerOpen(true);
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
    <div className="space-y-5 animate-fade-in">
      {/* Header - Mobile Responsive */}
      <header className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Meu Conteúdo</h1>
            <p className="text-gray-400 text-sm hidden sm:block">Gerencie seus posts e mídias</p>
          </div>
          {/* Desktop buttons */}
          <div className="hidden sm:flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowStoryModal(true)} className="flex items-center gap-1.5">
              <Camera size={16} /> Story
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowPackModal(true)} className="flex items-center gap-1.5">
              <Layers size={16} /> Pacote
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5">
              <Plus size={16} /> Post
            </Button>
          </div>
        </div>
        {/* Mobile buttons - horizontal scroll */}
        <div className="flex sm:hidden gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <Button variant="secondary" size="sm" onClick={() => setShowStoryModal(true)} className="flex-shrink-0 flex items-center gap-1.5 text-sm">
            <Camera size={16} /> Story
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowPackModal(true)} className="flex-shrink-0 flex items-center gap-1.5 text-sm">
            <Layers size={16} /> Pacote
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="flex-shrink-0 flex items-center gap-1.5 text-sm">
            <Plus size={16} /> Post
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

      {/* Pack hidden input */}
      <input
        type="file"
        ref={packFileInputRef}
        onChange={handlePackFileChange}
        accept="image/*,video/*"
        multiple
        className="hidden"
      />

      {/* Active Stories - Horizontal Carousel */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Camera size={20} className="text-brand-500" />
          Stories {myStories.length > 0 && `(${myStories.length})`}
        </h2>

        {myStories.length === 0 ? (
          <button
            onClick={() => setShowStoryModal(true)}
            className="w-full bg-dark-800/50 border border-dashed border-dark-600 hover:border-brand-500 rounded-xl p-4 text-center transition-colors"
          >
            <Camera size={24} className="mx-auto mb-1.5 text-gray-500" />
            <p className="text-gray-400 text-sm">Criar primeiro story</p>
            <p className="text-gray-500 text-xs mt-0.5">Expira em 24h</p>
          </button>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
            {myStories.map((story) => {
              const expiresAt = new Date(story.expiresAt);
              const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
              const url = resolveMediaUrl(story.thumbnailUrl || story.mediaUrl) || '';

              return (
                <div key={story.id} className="relative flex-shrink-0 group snap-start">
                  <button
                    onClick={handleOpenStory}
                    className="w-20 h-32 md:w-24 md:h-36 rounded-xl overflow-hidden bg-dark-800 border-2 border-brand-500/50 hover:border-brand-500 transition-colors"
                  >
                    {story.mediaType === 'video' ? (
                      <div className="relative w-full h-full">
                        <video src={url} className="w-full h-full object-cover" muted />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play size={16} className="text-white fill-white" />
                        </div>
                      </div>
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>

                  {/* Stats overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 rounded-b-xl pointer-events-none">
                    <div className="flex items-center justify-between text-[9px] text-white">
                      <span className="flex items-center gap-0.5">
                        <Eye size={8} /> {formatNumber(story.viewCount)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock size={8} /> {hoursLeft}h
                      </span>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ type: 'story', id: story.id });
                    }}
                    className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              );
            })}

            {/* Add Story Button */}
            <button
              onClick={() => setShowStoryModal(true)}
              className="w-20 h-32 md:w-24 md:h-36 flex-shrink-0 rounded-xl border-2 border-dashed border-dark-600 hover:border-brand-500 transition-colors flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:text-brand-500 snap-start"
            >
              <Plus size={20} />
              <span className="text-[10px]">Novo</span>
            </button>
          </div>
        )}
      </div>

      {/* Packs Management - Horizontal Carousel */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Layers size={20} className="text-brand-500" />
          Pacotes ({myPacks.length})
        </h2>

        {isLoadingPacks ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-40 h-48 bg-dark-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : myPacks.length === 0 ? (
          <button
            onClick={() => setShowPackModal(true)}
            className="w-full bg-dark-800/50 border border-dashed border-dark-600 hover:border-brand-500 rounded-xl p-6 text-center transition-colors"
          >
            <Layers size={28} className="mx-auto mb-2 text-gray-500" />
            <p className="text-gray-400 text-sm">Criar primeiro pacote</p>
          </button>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
            {myPacks.map((pack: PackData) => {
              const mediaCount = pack.media?.length || 0;

              // Convert pack to MediaPost format for viewing
              const openPackViewer = () => {
                if (!pack.media || pack.media.length === 0) {
                  toast.error('Este pacote não tem mídias');
                  return;
                }
                const mediaPost: MediaPost = {
                  id: pack.id,
                  media: pack.media.map((m, idx) => ({
                    url: m.url,
                    type: m.type,
                    thumbnailUrl: m.thumbnailUrl,
                    order: idx,
                    hasAccess: true,
                  })),
                  hasAccess: true,
                  visibility: pack.visibility,
                  creator: {
                    id: creator?.id || '',
                    displayName: creator?.displayName || '',
                    username: creator?.username || '',
                    avatarUrl: creator?.avatarUrl || undefined,
                    isVerified: creator?.isVerified,
                  },
                  text: pack.description || pack.name,
                  likeCount: 0,
                  commentCount: 0,
                  viewCount: pack.salesCount,
                };
                setSelectedPackView(mediaPost);
              };

              return (
                <div
                  key={pack.id}
                  onClick={openPackViewer}
                  className="group cursor-pointer flex-shrink-0 w-40 snap-start"
                >
                  {/* Compact Pack Card */}
                  <div className="relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-brand-600/20 via-dark-800 to-dark-900 border border-brand-500/30 hover:border-brand-500/60 transition-all">
                    {/* Ribbon accent */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-full bg-gradient-to-b from-brand-500/30 via-brand-500/10 to-brand-500/30" />

                    {/* Icon */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
                      <Layers size={14} className="text-brand-400" />
                    </div>

                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 pt-12">
                      <h3 className="font-bold text-white text-center text-xs leading-tight line-clamp-2 mb-1">{pack.name}</h3>
                      <span className="text-gray-400 text-[10px]">{mediaCount} {mediaCount === 1 ? 'item' : 'itens'}</span>
                    </div>

                    {/* Top badge */}
                    <div className="absolute top-1.5 left-1.5">
                      <Badge
                        variant={pack.visibility === 'public' ? 'success' : 'warning'}
                        className="text-[9px] px-1 py-0.5"
                      >
                        {pack.visibility === 'public' ? 'Pub' : 'Priv'}
                      </Badge>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ type: 'pack', id: pack.id });
                      }}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-500/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <Trash2 size={10} className="text-white" />
                    </button>

                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-brand-400 font-bold">{formatCurrency(pack.price)}</span>
                        <span className="text-gray-400">{pack.salesCount}x</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Pack Button at end */}
            <button
              onClick={() => setShowPackModal(true)}
              className="flex-shrink-0 w-40 h-48 rounded-xl border-2 border-dashed border-dark-600 hover:border-brand-500 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-brand-500 snap-start"
            >
              <Plus size={24} />
              <span className="text-xs">Novo</span>
            </button>
          </div>
        )}
      </div>

      {/* Create Story Modal */}
      <ResponsiveModal
        open={showStoryModal}
        onClose={isCreatingStory ? () => {} : resetStoryForm}
        title="Criar Story"
        size="md"
        showCloseButton={!isCreatingStory}
        footer={
          isCreatingStory ? (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="relative">
                <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${storyUpload.overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Progress Info */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span>
                    {storyUpload.overallProgress < 100
                      ? `Enviando ${storyFile ? formatFileSize(storyFile.size) : ''}...`
                      : 'Finalizando...'}
                  </span>
                </div>
                <span className="text-brand-500 font-bold text-lg">{storyUpload.overallProgress}%</span>
              </div>

              {/* Cancel Button */}
              <Button
                variant="secondary"
                onClick={() => {
                  storyUpload.cancel();
                  setIsCreatingStory(false);
                }}
                className="w-full"
              >
                Cancelar Upload
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={resetStoryForm}>
                Cancelar
              </Button>
              <Button onClick={handleCreateStory} disabled={!storyFile}>
                Publicar Story
              </Button>
            </div>
          )
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

      {/* Create Pack Modal */}
      <ResponsiveModal
        open={showPackModal}
        onClose={isCreatingPack ? () => {} : resetPackForm}
        title={isCreatingPack ? 'Criando pacote...' : 'Criar Pacote de Mídia'}
        size="xl"
        showCloseButton={!isCreatingPack}
        footer={
          isCreatingPack ? (
            <div className="space-y-4">
              <div className="relative">
                <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${packUpload.overallProgress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span>
                    {packUpload.overallProgress < 100 ? 'Enviando mídias...' : 'Finalizando...'}
                  </span>
                </div>
                <span className="text-brand-500 font-bold text-lg">{packUpload.overallProgress}%</span>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  packUpload.cancel();
                  setIsCreatingPack(false);
                }}
                className="w-full"
              >
                Cancelar Upload
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={resetPackForm} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleCreatePack}
                disabled={!packName.trim() || packMediaItems.length === 0}
                className="flex-1"
              >
                Criar Pacote
              </Button>
            </div>
          )
        }
      >
        <div className="space-y-5">
          {/* Pack Name */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Nome do Pacote *</label>
            <input
              type="text"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              placeholder="Ex: Ensaio Exclusivo, Fotos do Verão..."
              className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
              maxLength={100}
            />
          </div>

          {/* Pack Description */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Descrição (opcional)</label>
            <textarea
              value={packDescription}
              onChange={(e) => setPackDescription(e.target.value)}
              placeholder="Descreva o conteúdo do pacote..."
              rows={2}
              className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all resize-none"
              maxLength={500}
            />
          </div>

          {/* Pack Price */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Preço *</label>
            <input
              type="text"
              value={formatCurrency(packPrice)}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                setPackPrice(parseInt(raw) || 0);
              }}
              className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-brand-500 transition-all"
              placeholder="R$ 0,00"
            />
            <p className="text-xs text-gray-500 mt-1">Preço mínimo: R$ 1,00</p>
          </div>

          {/* Pack Visibility */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Visibilidade</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPackVisibility('public')}
                className={`px-4 py-4 rounded-xl text-sm font-medium transition-colors text-left ${
                  packVisibility === 'public'
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-base">
                  <Globe size={18} />
                  Público
                </div>
                <div className="text-xs opacity-80 mt-1">Visível no seu perfil para compra</div>
              </button>
              <button
                type="button"
                onClick={() => setPackVisibility('private')}
                className={`px-4 py-4 rounded-xl text-sm font-medium transition-colors text-left ${
                  packVisibility === 'private'
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-base">
                  <EyeOff size={18} />
                  Privado
                </div>
                <div className="text-xs opacity-80 mt-1">Apenas via mensagem direta</div>
              </button>
            </div>
          </div>

          {/* Pack Media */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Mídias do Pacote *</label>
              {packMediaItems.length > 0 && (
                <span className="text-xs text-gray-500">{packMediaItems.length} item(s)</span>
              )}
            </div>

            {packMediaItems.length === 0 ? (
              <button
                type="button"
                onClick={() => packFileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-dark-600 rounded-xl p-8 text-center hover:border-brand-500 transition-colors"
              >
                <Upload size={40} className="mx-auto mb-3 text-gray-500" />
                <p className="text-gray-300 font-medium">Clique para adicionar fotos ou vídeos</p>
                <p className="text-gray-500 text-sm mt-1">Adicione as mídias que farão parte deste pacote</p>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {packMediaItems.map((item) => (
                    <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-dark-800 group">
                      {item.type === 'video' ? (
                        <div className="relative w-full h-full">
                          <video src={item.url} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="p-2 bg-black/50 rounded-full">
                              <Play size={16} className="text-white fill-white" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => removePackMediaItem(item.id)}
                        className="absolute top-1 right-1 p-1.5 bg-red-500/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => packFileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-dark-600 rounded-xl p-3 text-center hover:border-brand-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} className="text-gray-500" />
                  <span className="text-gray-400 text-sm">Adicionar mais mídia</span>
                </button>
              </div>
            )}
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
              {/* Main Progress Bar */}
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

              {/* File status list (compact) */}
              {chunkedUpload.progress.length > 1 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {chunkedUpload.progress.map((file, idx) => (
                    <span key={idx} className={`px-2 py-1 rounded-full ${
                      file.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                      file.status === 'error' ? 'bg-red-500/20 text-red-400' :
                      file.status === 'uploading' ? 'bg-brand-500/20 text-brand-400' :
                      'bg-dark-700 text-gray-500'
                    }`}>
                      {file.status === 'complete' ? '✓' : file.status === 'uploading' ? '↑' : '○'} {file.fileName.slice(0, 15)}
                    </span>
                  ))}
                </div>
              )}

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

      {/* Posts Section - Horizontal Carousel */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Grid size={20} className="text-brand-500" />
          Posts ({posts.length})
        </h2>

        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-64 md:w-72 bg-dark-800 rounded-xl h-[260px] md:h-[290px] animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full bg-dark-800/50 border border-dashed border-dark-600 hover:border-brand-500 rounded-xl p-6 text-center transition-colors"
          >
            <ImageIcon size={28} className="mx-auto mb-2 text-gray-500" />
            <p className="text-gray-400 text-sm">Criar primeiro post</p>
          </button>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
            {posts.map((post: Content) => (
              <div
                key={post.id}
                className="flex-shrink-0 w-64 md:w-72 snap-start group cursor-pointer"
                onClick={() => navigate(`/post/${post.id}`)}
              >
                <div className="bg-dark-800 rounded-xl overflow-hidden border border-dark-700 hover:border-dark-600 transition-all">
                  {/* Media Preview */}
                  <div className="relative aspect-[4/3]">
                    {post.media?.[0] ? (
                      <MediaThumbnail media={post.media[0]} />
                    ) : (
                      <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                        <ImageIcon size={28} className="text-dark-500" />
                      </div>
                    )}

                    {/* Multiple media indicator */}
                    {post.media.length > 1 && (
                      <div className="absolute top-2 left-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] backdrop-blur-md flex items-center gap-1">
                        <Layers size={10} /> {post.media.length}
                      </div>
                    )}

                    {/* Visibility badge */}
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={post.visibility === 'public' ? 'success' : post.visibility === 'subscribers' ? 'warning' : 'default'}
                        className="text-[10px] px-1.5 py-0.5"
                      >
                        {post.visibility === 'public' ? 'Pub' : post.visibility === 'subscribers' ? 'Assin' : 'PPV'}
                      </Badge>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ type: 'post', id: post.id });
                      }}
                      className="absolute bottom-2 right-2 p-1.5 bg-red-500/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} className="text-white" />
                    </button>

                    {/* PPV Price */}
                    {post.visibility === 'ppv' && (
                      <div className="absolute bottom-2 left-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] backdrop-blur-md flex items-center gap-1">
                        <Lock size={10} /> {formatCurrency(post.ppvPrice || 0)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    <p className="text-xs text-gray-300 line-clamp-2 mb-2 min-h-[2rem]">{post.text || 'Sem descrição'}</p>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Heart size={10} /> {formatNumber(post.likeCount || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={10} /> {formatNumber(post.commentCount || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={10} /> {formatNumber(post.viewCount || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Post Button at end - matches post card height */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-shrink-0 w-64 md:w-72 rounded-xl border-2 border-dashed border-dark-600 hover:border-brand-500 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-brand-500 snap-start min-h-[260px] md:min-h-[290px]"
            >
              <Plus size={28} />
              <span className="text-sm">Novo Post</span>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ResponsiveModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={
          deleteTarget?.type === 'story' ? 'Excluir Story' :
          deleteTarget?.type === 'pack' ? 'Excluir Pacote' : 'Excluir Post'
        }
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (deleteTarget) {
                  if (deleteTarget.type === 'story') {
                    deleteStory.mutate(deleteTarget.id);
                  } else if (deleteTarget.type === 'pack') {
                    deletePack.mutate(deleteTarget.id);
                  } else {
                    deletePost.mutate(deleteTarget.id);
                  }
                  setDeleteTarget(null);
                }
              }}
              isLoading={deletePost.isPending || deleteStory.isPending || deletePack.isPending}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              <Trash2 size={16} className="mr-1" />
              Excluir
            </Button>
          </div>
        }
      >
        <p className="text-gray-300 text-center">
          Tem certeza que deseja excluir este {
            deleteTarget?.type === 'story' ? 'story' :
            deleteTarget?.type === 'pack' ? 'pacote' : 'post'
          }?
          <br />
          <span className="text-sm text-gray-500">Esta ação não pode ser desfeita.</span>
        </p>
      </ResponsiveModal>

      {/* Story Viewer */}
      {storyViewerOpen && myStoriesAsCreator.length > 0 && (
        <StoryViewer
          creators={myStoriesAsCreator}
          initialCreatorIndex={0}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}

      {/* Pack Media Viewer */}
      {selectedPackView && (
        <MediaViewer
          post={selectedPackView}
          onClose={() => setSelectedPackView(null)}
        />
      )}
    </div>
  );
}
