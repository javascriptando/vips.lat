import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShoppingBag, Bookmark, Lock, Camera, LogOut, Heart, UserMinus, Users } from 'lucide-react';
import { Card, Avatar, Button, Input, ResponsiveModal } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  username: z.string().min(3, 'Username deve ter pelo menos 3 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e _'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function UserProfileView() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'following' | 'subscriptions' | 'history'>('profile');
  const [unfollowTarget, setUnfollowTarget] = useState<{ id: string; name: string } | null>(null);
  const { user, checkAuth, logout } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      username: user?.username || '',
    },
  });

  const { data: paymentHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['userPaymentHistory'],
    queryFn: () => api.getPaymentHistory(),
  });

  const { data: subscriptionsData } = useQuery({
    queryKey: ['mySubscriptions'],
    queryFn: () => api.getMySubscriptions(),
  });

  const { data: savedData } = useQuery({
    queryKey: ['savedPosts'],
    queryFn: () => api.getSavedPosts(),
  });

  const { data: purchasedData } = useQuery({
    queryKey: ['purchasedContent'],
    queryFn: () => api.getPurchasedContent(),
  });

  const { data: followingData, isLoading: isLoadingFollowing } = useQuery({
    queryKey: ['favoriteCreators'],
    queryFn: () => api.getFavoriteCreators(),
  });

  const unfollowCreator = useMutation({
    mutationFn: (creatorId: string) => api.toggleFavorite(creatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteCreators'] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Deixou de seguir');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => api.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      checkAuth();
      toast.success('Avatar atualizado!');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateProfile = useMutation({
    mutationFn: (data: ProfileFormData) => api.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      checkAuth();
      toast.success('Perfil atualizado!');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelSubscription = useMutation({
    mutationFn: (id: string) => api.cancelSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubscriptions'] });
      toast.success('Assinatura cancelada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar.mutate(file);
    }
  };

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data);
  };

  const history = paymentHistory || [];
  const subscriptions = Array.isArray(subscriptionsData)
    ? subscriptionsData
    : (subscriptionsData as any)?.data || [];
  const activeSubscriptions = subscriptions.filter((s: any) => s.status === 'active').length;
  const purchasedCount = purchasedData?.data?.length || 0;
  const savedCount = savedData?.data?.length || 0;
  const followingCreators = followingData?.creators || [];
  const followingCount = followingCreators.length;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header - Simple Avatar Only */}
      <div className="flex items-end gap-6 mb-8 pt-4">
        <div className="relative">
          <Avatar
            src={user?.avatarUrl}
            name={user?.name || user?.username}
            size="xl"
            className="w-32 h-32 border-4 border-dark-800 shadow-2xl"
          />
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            className="absolute bottom-2 right-2 p-1.5 bg-dark-700 text-white rounded-full border-2 border-dark-800 hover:bg-dark-600 transition-colors disabled:opacity-50"
          >
            {uploadAvatar.isPending ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera size={14} />
            )}
          </button>
        </div>
        <div className="flex-1 mb-4">
          <h1 className="text-2xl font-bold text-white">{user?.name || 'Usuário'}</h1>
          <p className="text-gray-400">@{user?.username || 'username'}</p>
        </div>
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="mb-4 p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Sair da conta"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-dark-700 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Meus Dados
        </button>
        <button
          onClick={() => setActiveTab('following')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'following'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Seguindo
          {followingCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-500 rounded-full">
              {followingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'subscriptions'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Assinaturas
          {activeSubscriptions > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-500 rounded-full">
              {activeSubscriptions}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Histórico
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          {activeTab === 'profile' && (
            <Card className="animate-slide-up">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Nome Completo"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="opacity-50"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                      <input
                        {...register('username')}
                        className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-8 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        placeholder="seu_username"
                      />
                    </div>
                    {errors.username?.message && (
                      <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-dark-700">
                  <Button type="submit" isLoading={updateProfile.isPending}>
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'following' && (
            <div className="space-y-4 animate-slide-up">
              {isLoadingFollowing ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 bg-dark-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : followingCreators.length > 0 ? (
                followingCreators.map((creator: any) => (
                  <Card key={creator.id} className="flex items-center justify-between gap-4">
                    <Link to={`/creator/${creator.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar
                        src={creator.avatarUrl}
                        name={creator.displayName}
                        size="lg"
                        className="flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <h3 className="font-bold text-white truncate">
                            {creator.displayName || 'Criador'}
                          </h3>
                          {creator.isVerified && (
                            <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-400 truncate">@{creator.username}</p>
                      </div>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setUnfollowTarget({ id: creator.id, name: creator.displayName })}
                      disabled={unfollowCreator.isPending}
                      className="flex-shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <UserMinus size={16} />
                      <span className="hidden sm:inline ml-1">Deixar de seguir</span>
                    </Button>
                  </Card>
                ))
              ) : (
                <Card className="text-center py-12">
                  <Users size={48} className="mx-auto mb-4 text-dark-500" />
                  <p className="text-gray-400 mb-4">Você ainda não segue nenhum criador.</p>
                  <Link to="/explore">
                    <Button>Explorar Criadores</Button>
                  </Link>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="space-y-4 animate-slide-up">
              {subscriptions.length > 0 ? (
                subscriptions.map((sub: any) => (
                  <Card key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Link to={`/creator/${sub.username || sub.creator?.username}`} className="flex items-center gap-4">
                      <Avatar
                        src={sub.avatarUrl || sub.creator?.avatarUrl}
                        name={sub.displayName || sub.creator?.displayName}
                        size="lg"
                        className="border-2 border-brand-500"
                      />
                      <div>
                        <div className="flex items-center gap-1">
                          <h3 className="font-bold text-white">
                            {sub.displayName || sub.creator?.displayName || 'Criador'}
                          </h3>
                          {(sub.verified || sub.creator?.isVerified) && (
                            <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20" />
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          @{sub.username || sub.creator?.username || 'username'}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {sub.status === 'active' ? 'Expira em' : 'Status'}
                        </div>
                        <div className="font-bold text-white text-sm">
                          {sub.status === 'active' && sub.expiresAt
                            ? formatDate(sub.expiresAt)
                            : sub.status === 'cancelled'
                            ? 'Cancelado'
                            : sub.status === 'pending'
                            ? 'Pendente'
                            : 'Expirado'}
                        </div>
                      </div>
                      {sub.status === 'active' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja cancelar esta assinatura?')) {
                              cancelSubscription.mutate(sub.id);
                            }
                          }}
                          isLoading={cancelSubscription.isPending}
                          className="text-xs"
                        >
                          Cancelar
                        </Button>
                      )}
                      {sub.status === 'pending' && (
                        <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                          Aguardando pagamento
                        </span>
                      )}
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="text-center py-12">
                  <Heart size={48} className="mx-auto mb-4 text-dark-500" />
                  <p className="text-gray-400 mb-4">Você ainda não assina nenhum criador.</p>
                  <Link to="/explore">
                    <Button>Explorar Criadores</Button>
                  </Link>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <Card className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-white">Transações Realizadas (PIX)</h3>
              </div>
              {isLoadingHistory ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-dark-700 rounded animate-pulse" />
                  ))}
                </div>
              ) : history.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-dark-700">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-dark-900">
                      <tr className="text-xs text-gray-400 uppercase tracking-wider">
                        <th className="p-4 font-medium">Tipo</th>
                        <th className="p-4 font-medium text-center">Data</th>
                        <th className="p-4 font-medium text-right">Valor</th>
                        <th className="p-4 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {history.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-dark-700/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-dark-700 rounded-lg text-gray-300">
                                {tx.type === 'ppv' ? <Lock size={16} /> : <CheckCircle2 size={16} />}
                              </div>
                              <span className="text-sm font-medium text-white">
                                {tx.type === 'subscription' ? 'Assinatura' : tx.type === 'ppv' ? 'PPV' : tx.type === 'tip' ? 'Gorjeta' : tx.type}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-center text-sm text-gray-500">
                            {formatDate(tx.createdAt)}
                          </td>
                          <td className="p-4 text-right text-sm font-bold text-white">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                                ${tx.status === 'confirmed' ? 'bg-green-500/10 text-green-500' : ''}
                                ${tx.status === 'failed' || tx.status === 'expired' ? 'bg-red-500/10 text-red-500' : ''}
                                ${tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : ''}
                              `}
                            >
                              {tx.status === 'confirmed' && 'Pago'}
                              {(tx.status === 'failed' || tx.status === 'expired') && 'Falhou'}
                              {tx.status === 'pending' && 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Nenhuma transação realizada.</p>
              )}
            </Card>
          )}
        </div>

        {/* Right Sidebar Stats */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-gradient-to-br from-dark-800 to-dark-900">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Estatísticas</h4>
            <div className="space-y-4">
              <button
                onClick={() => setActiveTab('following')}
                className="w-full flex items-center justify-between p-3 bg-dark-950/50 rounded-xl border border-dark-800 hover:border-brand-500/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-500/10 text-pink-500 rounded-lg">
                    <Users size={16} />
                  </div>
                  <span className="text-sm text-gray-300">Seguindo</span>
                </div>
                <span className="text-white font-bold">{followingCount}</span>
              </button>
              <div className="flex items-center justify-between p-3 bg-dark-950/50 rounded-xl border border-dark-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-500/10 text-brand-500 rounded-lg">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-sm text-gray-300">Assinaturas Ativas</span>
                </div>
                <span className="text-white font-bold">{activeSubscriptions}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-dark-950/50 rounded-xl border border-dark-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                    <ShoppingBag size={16} />
                  </div>
                  <span className="text-sm text-gray-300">Itens Comprados</span>
                </div>
                <span className="text-white font-bold">{purchasedCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-dark-950/50 rounded-xl border border-dark-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                    <Bookmark size={16} />
                  </div>
                  <span className="text-sm text-gray-300">Posts Salvos</span>
                </div>
                <span className="text-white font-bold">{savedCount}</span>
              </div>
            </div>
          </Card>

        </div>
      </div>

      {/* Unfollow Confirmation Modal */}
      <ResponsiveModal
        open={!!unfollowTarget}
        onClose={() => setUnfollowTarget(null)}
        title="Deixar de seguir"
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setUnfollowTarget(null)} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (unfollowTarget) {
                  unfollowCreator.mutate(unfollowTarget.id);
                  setUnfollowTarget(null);
                }
              }}
              isLoading={unfollowCreator.isPending}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              Deixar de seguir
            </Button>
          </div>
        }
      >
        <p className="text-gray-300 text-center">
          Tem certeza que deseja deixar de seguir <span className="font-semibold text-white">{unfollowTarget?.name}</span>?
        </p>
      </ResponsiveModal>
    </div>
  );
}
