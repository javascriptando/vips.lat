import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Edit3, User as UserIcon, CreditCard, QrCode, Shield, LogOut, ExternalLink, Copy, Check, FileText, Upload, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, Button, Input, Avatar } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency, resolveMediaUrl } from '@/lib/utils';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  username: z.string()
    .min(3, 'Username deve ter pelo menos 3 caracteres')
    .max(30, 'Username deve ter no máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e _'),
  bio: z.string().optional(),
  subscriptionPrice: z.coerce.number().min(999, 'Preço mínimo é R$ 9,99').max(99999, 'Preço máximo é R$ 999,99'),
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
  const docFrontInputRef = useRef<HTMLInputElement>(null);
  const docBackInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // KYC state
  const [kycDocType, setKycDocType] = useState<'rg' | 'cnh' | 'passport'>('rg');
  const [kycDocFront, setKycDocFront] = useState<File | null>(null);
  const [kycDocBack, setKycDocBack] = useState<File | null>(null);
  const [kycSelfie, setKycSelfie] = useState<File | null>(null);
  const [kycFullName, setKycFullName] = useState('');
  const [kycBirthDate, setKycBirthDate] = useState('');
  const [kycCpf, setKycCpf] = useState('');
  const [kycSubmitting, setKycSubmitting] = useState(false);

  // KYC Query
  const { data: kycData, refetch: refetchKyc } = useQuery({
    queryKey: ['kyc-status'],
    queryFn: () => api.getKycStatus(),
    enabled: !!creator,
  });

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
      username: user?.username || '',
      bio: creator?.bio || '',
      subscriptionPrice: creator?.subscriptionPrice || 2990,
    },
  });

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
      // Atualizar username do usuário
      await api.updateProfile({ username: data.username });
      // Atualizar perfil do criador
      await api.updateCreatorProfile({
        displayName: data.displayName,
        bio: data.bio,
        subscriptionPrice: data.subscriptionPrice,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatorProfile'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      loadCreatorProfile();
      checkAuth();
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

  const handleKycSubmit = async () => {
    if (!kycDocFront || !kycSelfie || !kycFullName || !kycBirthDate || !kycCpf) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (kycDocType === 'rg' && !kycDocBack) {
      toast.error('Para RG, envie também a foto do verso');
      return;
    }

    setKycSubmitting(true);
    try {
      await api.submitKyc({
        documentType: kycDocType,
        documentFront: kycDocFront,
        documentBack: kycDocBack || undefined,
        selfie: kycSelfie,
        fullName: kycFullName,
        birthDate: kycBirthDate,
        cpf: kycCpf.replace(/\D/g, ''),
      });
      toast.success('Documentos enviados! Aguarde a análise.');
      refetchKyc();
      // Reset form
      setKycDocFront(null);
      setKycDocBack(null);
      setKycSelfie(null);
      setKycFullName('');
      setKycBirthDate('');
      setKycCpf('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar documentos');
    } finally {
      setKycSubmitting(false);
    }
  };

  const formatCpfInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: number) => void) => {
    const raw = e.target.value.replace(/\D/g, '');
    const cents = parseInt(raw) || 0;
    setPriceDisplay(formatCurrency(cents));
    onChange(cents);
  };

  // Get creator avatar from user (since creator avatar comes from user table)
  const avatarUrl = user?.avatarUrl || creator?.avatarUrl;

  const [copied, setCopied] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const publicProfileUrl = creator?.username
    ? `${window.location.origin}/${creator.username}`
    : null;

  const handleCopyLink = () => {
    if (publicProfileUrl) {
      navigator.clipboard.writeText(publicProfileUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
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

      {/* Public Profile Link */}
      {publicProfileUrl && (
        <Card className="bg-gradient-to-r from-brand-900/30 to-purple-900/30 border-brand-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-semibold mb-1">Seu Perfil Público</h3>
              <p className="text-sm text-gray-400 break-all">{publicProfileUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => window.open(publicProfileUrl, '_blank')}
                className="shrink-0"
              >
                <ExternalLink size={16} />
                Visualizar
              </Button>
            </div>
          </div>
        </Card>
      )}

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
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                  <input
                    {...register('username')}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-all"
                    placeholder="seu_username"
                  />
                </div>
                {errors.username?.message && (
                  <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
                )}
              </div>
            </div>
            <div className="mt-4">
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

        {/* Pix Key Section - Automático baseado no CPF do KYC */}
        <Card>
          <CardHeader icon={<QrCode size={20} className="text-blue-500" />} title="Dados de Recebimento (PIX)" />

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 mb-4">
            <Shield className="text-blue-500 shrink-0" size={20} />
            <p className="text-sm text-blue-200">
              Por segurança, sua chave PIX é automaticamente o CPF verificado no KYC. Isso garante que os pagamentos vão para a pessoa correta.
            </p>
          </div>

          {kycData?.status !== 'approved' ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex gap-3">
              <AlertCircle className="text-yellow-500 shrink-0" size={20} />
              <div>
                <p className="text-yellow-400 font-medium">Verificação necessária</p>
                <p className="text-sm text-yellow-200/70">Complete a verificação KYC abaixo para ativar sua chave PIX e receber pagamentos.</p>
              </div>
            </div>
          ) : creator?.asaasPixKey ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="text-green-500" size={20} />
                <p className="text-green-400 font-medium">Chave PIX ativa</p>
              </div>
              <p className="text-xs text-gray-400">Tipo: CPF</p>
              <p className="text-sm text-white font-mono mt-1">{creator.asaasPixKey}</p>
            </div>
          ) : (
            <Button
              type="button"
              onClick={async () => {
                try {
                  await api.activatePixKey();
                  toast.success('Chave PIX ativada com sucesso!');
                  loadCreatorProfile();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erro ao ativar chave PIX');
                }
              }}
              className="w-full"
            >
              <QrCode size={16} /> Ativar Chave PIX com meu CPF
            </Button>
          )}
        </Card>

        {/* KYC Verification Section */}
        <Card>
          <CardHeader icon={<Shield size={20} className="text-purple-500" />} title="Verificação de Identidade (KYC)" />

          {/* Status Display */}
          {kycData?.status === 'approved' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex gap-3 items-center">
              <CheckCircle className="text-green-500 shrink-0" size={24} />
              <div>
                <p className="text-green-400 font-semibold">Identidade Verificada</p>
                <p className="text-sm text-green-200/70">Sua conta está verificada e você pode solicitar saques.</p>
              </div>
            </div>
          )}

          {(kycData?.status === 'pending' || kycData?.status === 'under_review') && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex gap-3 items-center">
              <Clock className="text-yellow-500 shrink-0 animate-pulse" size={24} />
              <div>
                <p className="text-yellow-400 font-semibold">Em Análise</p>
                <p className="text-sm text-yellow-200/70">Seus documentos estão sendo analisados. Isso pode levar até 24 horas.</p>
              </div>
            </div>
          )}

          {kycData?.status === 'rejected' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3 items-start">
                <XCircle className="text-red-500 shrink-0" size={24} />
                <div>
                  <p className="text-red-400 font-semibold">Verificação Rejeitada</p>
                  <p className="text-sm text-red-200/70">
                    {kycData.verification?.rejectedReason || 'Seus documentos foram rejeitados. Por favor, envie novamente com fotos mais claras.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form for none or rejected */}
          {(!kycData?.status || kycData.status === 'none' || kycData.status === 'rejected' || kycData.status === 'expired') && (
            <>
              {(!kycData?.status || kycData.status === 'none') && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 flex gap-3 mb-6">
                  <AlertCircle className="text-purple-500 shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-purple-200">
                      <strong>Importante:</strong> Para solicitar saques, você precisa verificar sua identidade enviando um documento com foto e uma selfie.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Document Type */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-1.5">Tipo de Documento</label>
                  <select
                    value={kycDocType}
                    onChange={(e) => setKycDocType(e.target.value as 'rg' | 'cnh' | 'passport')}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                  >
                    <option value="rg">RG (Identidade)</option>
                    <option value="cnh">CNH (Carteira de Motorista)</option>
                    <option value="passport">Passaporte</option>
                  </select>
                </div>

                {/* Personal Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1.5">Nome Completo (como no documento)</label>
                    <input
                      type="text"
                      value={kycFullName}
                      onChange={(e) => setKycFullName(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1.5">Data de Nascimento</label>
                    <input
                      type="date"
                      value={kycBirthDate}
                      onChange={(e) => setKycBirthDate(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                    />
                  </div>
                </div>

                <div className="md:w-1/2">
                  <label className="text-xs font-medium text-gray-400 block mb-1.5">CPF</label>
                  <input
                    type="text"
                    value={kycCpf}
                    onChange={(e) => setKycCpf(formatCpfInput(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                    placeholder="000.000.000-00"
                  />
                </div>

                {/* Document Upload */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Front */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1.5">
                      Documento (Frente) *
                    </label>
                    <input
                      ref={docFrontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setKycDocFront(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => docFrontInputRef.current?.click()}
                      className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${
                        kycDocFront
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-dark-600 hover:border-brand-500 bg-dark-900'
                      }`}
                    >
                      {kycDocFront ? (
                        <>
                          <CheckCircle className="text-green-500 mb-2" size={24} />
                          <span className="text-xs text-green-400 text-center px-2 truncate max-w-full">
                            {kycDocFront.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="text-gray-500 mb-2" size={24} />
                          <span className="text-xs text-gray-500">Clique para enviar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Back (only for RG) */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1.5">
                      Documento (Verso) {kycDocType === 'rg' ? '*' : '(opcional)'}
                    </label>
                    <input
                      ref={docBackInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setKycDocBack(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => docBackInputRef.current?.click()}
                      className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${
                        kycDocBack
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-dark-600 hover:border-brand-500 bg-dark-900'
                      }`}
                    >
                      {kycDocBack ? (
                        <>
                          <CheckCircle className="text-green-500 mb-2" size={24} />
                          <span className="text-xs text-green-400 text-center px-2 truncate max-w-full">
                            {kycDocBack.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="text-gray-500 mb-2" size={24} />
                          <span className="text-xs text-gray-500">Clique para enviar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Selfie */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1.5">
                      Selfie com Documento *
                    </label>
                    <input
                      ref={selfieInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setKycSelfie(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => selfieInputRef.current?.click()}
                      className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${
                        kycSelfie
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-dark-600 hover:border-brand-500 bg-dark-900'
                      }`}
                    >
                      {kycSelfie ? (
                        <>
                          <CheckCircle className="text-green-500 mb-2" size={24} />
                          <span className="text-xs text-green-400 text-center px-2 truncate max-w-full">
                            {kycSelfie.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="text-gray-500 mb-2" size={24} />
                          <span className="text-xs text-gray-500">Clique para enviar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  * Na selfie, segure seu documento ao lado do rosto. Certifique-se de que as informações estejam legíveis.
                </p>

                <Button
                  type="button"
                  onClick={handleKycSubmit}
                  isLoading={kycSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <FileText size={16} />
                  Enviar Documentos
                </Button>
              </div>
            </>
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
