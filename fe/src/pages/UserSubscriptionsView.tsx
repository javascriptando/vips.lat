import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Avatar, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export function UserSubscriptionsView() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['mySubscriptions'],
    queryFn: () => api.getMySubscriptions(),
  });

  const cancelSubscription = useMutation({
    mutationFn: (id: string) => api.cancelSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubscriptions'] });
      toast.success('Assinatura cancelada');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // The API returns PaginatedResponse or array directly
  const subs = Array.isArray(data) ? data : (data as any)?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white mb-2">Minhas Assinaturas</h1>
        <p className="text-gray-400">Criadores que você apoia.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subs.map((sub: any) => (
          <Card key={sub.id} className="flex items-center justify-between">
            <Link to={`/creator/${sub.username || sub.creator?.username}`} className="flex items-center gap-4">
              <Avatar
                src={sub.avatarUrl || sub.creator?.avatarUrl}
                name={sub.displayName || sub.creator?.displayName}
                size="lg"
                className="border-2 border-brand-500"
              />
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="font-bold text-white text-lg">
                    {sub.displayName || sub.creator?.displayName || 'Criador'}
                  </h3>
                  {(sub.verified || sub.creator?.isVerified) && (
                    <CheckCircle2 size={16} className="text-blue-500 fill-blue-500/20" />
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  @{sub.username || sub.creator?.username || 'username'}
                </p>
              </div>
            </Link>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">
                {sub.status === 'active' ? 'Expira em' : 'Status'}
              </div>
              <div className="font-bold text-white mb-2">
                {sub.status === 'active' && sub.expiresAt
                  ? formatDate(sub.expiresAt)
                  : sub.status === 'cancelled'
                  ? 'Cancelado'
                  : sub.status === 'pending'
                  ? 'Pendente'
                  : 'Expirado'}
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
        ))}

        {subs.length === 0 && (
          <Card className="col-span-full text-center py-16">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-dark-500" />
            <p className="text-gray-400 mb-4">Você ainda não assina nenhum criador.</p>
            <Link to="/explore">
              <Button>Explorar Criadores</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
