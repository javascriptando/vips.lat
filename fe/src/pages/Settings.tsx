import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Edit3, User as UserIcon, CreditCard, QrCode, Shield, LogOut } from 'lucide-react';
import { Card, CardHeader, Button, Input, Avatar } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency, resolveMediaUrl } from '@/lib/utils';

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

const pixKeyPatterns: Record<PixKeyType, RegExp> = {
  CPF: /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/,
  CNPJ: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+55\d{10,11}$|^\d{10,11}$/,
  EVP: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
};

const pixKeyLabels: Record<PixKeyType, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'E-mail',
  PHONE: 'Telefone',
  EVP: 'Chave Aleatória',
};

const pixKeyPlaceholders: Record<PixKeyType, string> = {
  CPF: '000.000.000-00',
  CNPJ: '00.000.000/0000-00',
  EMAIL: 'seu@email.com',
  PHONE: '+5511999999999',
  EVP: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

const profileSchema = z.object({
  displayName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  bio: z.string().optional(),
  subscriptionPrice: z.coerce.number().min(999, 'Preço mínimo é R$ 9,99').max(99999, 'Preço máximo é R$ 999,99'),
  pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP']).optional(),
  pixKey: z.string().optional(),
}).refine((data) => {
  if (data.pixKey && data.pixKey.trim() && data.pixKeyType) {
    return pixKeyPatterns[data.pixKeyType].test(data.pixKey);
  }
  return true;
}, {
  message: 'Chave PIX inválida para o tipo selecionado',
  path: ['pixKey'],
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { creator, user, loadCreatorProfile, checkAuth, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState(
    creator?.subscriptionPrice ? formatCurrency(creator.subscriptionPrice) : 'R$ 29,90'
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: creator?.displayName || '',
      bio: creator?.bio || '',
      subscriptionPrice: creator?.subscriptionPrice || 2990,
      pixKeyType: undefined,
      pixKey: '',
    },
  });

  const selectedPixKeyType = watch('pixKeyType');

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => api.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatorProfile'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      loadCreatorProfile();
      checkAuth();
      toast.success('Avatar atualizado!');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadCover = useMutation({
    mutationFn: (file: File) => api.uploadCover(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatorProfile'] });
      loadCreatorProfile();
      toast.success('Banner atualizado!');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateProfile = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      await api.updateCreatorProfile({
        displayName: data.displayName,
        bio: data.bio,
        subscriptionPrice: data.subscriptionPrice,
      });
      if (data.pixKey && data.pixKey.trim() && data.pixKeyType) {
        await api.setPixKey(data.pixKey, data.pixKeyType);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatorProfile'] });
      loadCreatorProfile();
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      await updateProfile.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar.mutate(file);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadCover.mutate(file);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: number) => void) => {
    const raw = e.target.value.replace(/\D/g, '');
    const cents = parseInt(raw) || 0;
    setPriceDisplay(formatCurrency(cents));
    onChange(cents);
  };

  // Get creator avatar from user (since creator avatar comes from user table)
  const avatarUrl = user?.avatarUrl || creator?.avatarUrl;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Configurações</h1>
          <p className="text-gray-400 text-sm">Gerencie seu perfil, pagamentos e segurança.</p>
        </div>
        <button
          onClick={handleLogout}
          className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Sair da conta"
        >
          <LogOut size={20} />
        </button>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Banner & Avatar Section */}
        <Card padding="none" className="overflow-hidden">
          <div className="h-40 w-full bg-dark-900 relative">
            {creator?.coverUrl ? (
              <img src={resolveMediaUrl(creator.coverUrl) || ''} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-brand-900 to-purple-900" />
            )}
            <div className="absolute inset-0 bg-black/20" />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadCover.isPending}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-md transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Camera size={14} /> {uploadCover.isPending ? 'Enviando...' : 'Editar Banner'}
            </button>
          </div>
          <div className="px-6 pb-6 relative">
            <div className="flex justify-between items-end -mt-12 mb-6">
              <div className="relative">
                <Avatar src={avatarUrl} name={creator?.displayName} size="xl" className="border-4 border-dark-800" />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadAvatar.isPending}
                  className="absolute bottom-0 right-0 p-1.5 bg-brand-500 rounded-full text-white border-2 border-dark-800 hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>

            <CardHeader icon={<UserIcon size={20} className="text-brand-500" />} title="Dados do Perfil" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nome de Exibição"
                placeholder="Seu nome artístico"
                error={errors.displayName?.message}
                {...register('displayName')}
              />
              <Input label="Email" type="email" value={user?.email || ''} disabled className="opacity-50" />
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Bio</label>
              <textarea
                rows={3}
                placeholder="Conte um pouco sobre você..."
                className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all resize-none"
                {...register('bio')}
              />
            </div>
          </div>
        </Card>

        {/* Pricing Section */}
        <Card>
          <CardHeader icon={<CreditCard size={20} className="text-green-500" />} title="Assinatura & Preços" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Valor da Assinatura Mensal</label>
              <Controller
                name="subscriptionPrice"
                control={control}
                render={({ field }) => (
                  <input
                    type="text"
                    value={priceDisplay}
                    onChange={(e) => handlePriceChange(e, field.onChange)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-brand-500 transition-all"
                    placeholder="R$ 29,90"
                  />
                )}
              />
              {errors.subscriptionPrice && (
                <p className="text-red-500 text-xs mt-1">{errors.subscriptionPrice.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Você recebe 90% ({formatCurrency(Math.floor((watch('subscriptionPrice') || 0) * 0.9))}) por assinatura.
              </p>
            </div>
          </div>
        </Card>

        {/* Pix Key Section */}
        <Card>
          <CardHeader icon={<QrCode size={20} className="text-blue-500" />} title="Dados de Recebimento (PIX)" />

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 mb-6">
            <Shield className="text-blue-500 shrink-0" size={20} />
            <p className="text-sm text-blue-200">
              Seus pagamentos são processados automaticamente via Asaas e transferidos para esta chave PIX.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Tipo de Chave PIX</label>
              <select
                {...register('pixKeyType')}
                className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
              >
                <option value="">Selecione o tipo</option>
                {(Object.keys(pixKeyLabels) as PixKeyType[]).map((type) => (
                  <option key={type} value={type}>
                    {pixKeyLabels[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">
                Chave PIX {selectedPixKeyType ? `(${pixKeyLabels[selectedPixKeyType]})` : ''}
              </label>
              <Input
                placeholder={selectedPixKeyType ? pixKeyPlaceholders[selectedPixKeyType] : 'Selecione o tipo primeiro'}
                error={errors.pixKey?.message}
                disabled={!selectedPixKeyType}
                {...register('pixKey')}
              />
            </div>
          </div>

          {creator?.asaasPixKey && (
            <div className="mt-4 p-3 bg-dark-900 rounded-lg border border-dark-700">
              <p className="text-xs text-gray-400">Chave PIX atual:</p>
              <p className="text-sm text-white font-mono">{creator.asaasPixKey}</p>
            </div>
          )}
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" isLoading={isLoading} className="bg-white text-black hover:bg-gray-200">
            Salvar Alterações
          </Button>
        </div>
      </form>

    </div>
  );
}
