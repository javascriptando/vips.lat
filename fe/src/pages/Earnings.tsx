import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, QrCode, Crown } from 'lucide-react';
import { Card, CardHeader, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

export function Earnings() {
  const queryClient = useQueryClient();
  const [isRequesting, setIsRequesting] = useState(false);

  const { data: balance } = useQuery({
    queryKey: ['payoutBalance'],
    queryFn: () => api.getPayoutBalance(),
  });

  const { data: payouts } = useQuery({
    queryKey: ['payouts'],
    queryFn: () => api.getPayoutHistory(),
  });

  const requestPayout = useMutation({
    mutationFn: () => api.requestPayout(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payoutBalance'] });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      toast.success('Saque solicitado com sucesso!');
      setIsRequesting(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setIsRequesting(false);
    },
  });

  const payoutLimit = balance?.payoutLimit;
  const canRequestPayout =
    (balance?.available || 0) >= (balance?.minPayout || 2000) &&
    (payoutLimit?.remaining || 0) > 0;

  const handleRequestPayout = () => {
    if ((balance?.available || 0) < (balance?.minPayout || 2000)) {
      toast.error(`Saldo mínimo para saque: ${formatCurrency(balance?.minPayout || 2000)}`);
      return;
    }
    if ((payoutLimit?.remaining || 0) <= 0) {
      toast.error(`Limite de ${payoutLimit?.limit || 4} saques/mês atingido`);
      return;
    }
    setIsRequesting(true);
    requestPayout.mutate();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white mb-2">Financeiro</h1>
        <p className="text-gray-400">Gerencie seus saques e histórico.</p>
      </header>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-dark-800 to-dark-800 border border-dark-700 rounded-2xl p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <p className="text-gray-400 mb-1">Saldo Disponível para Saque</p>
            <h2 className="text-4xl font-bold text-white">{formatCurrency(balance?.available || 0)}</h2>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500">Saldo pendente: {formatCurrency(balance?.pending || 0)}</p>
              {balance?.payoutFee && balance.available > 0 && (
                <div className="text-sm">
                  <span className="text-gray-500">Taxa PIX: </span>
                  <span className="text-red-400">-{formatCurrency(balance.payoutFee)}</span>
                  <span className="text-gray-500 mx-2">=</span>
                  <span className="text-green-400 font-medium">
                    Você recebe: {formatCurrency(balance.netAvailable || 0)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              onClick={handleRequestPayout}
              isLoading={isRequesting}
              disabled={!canRequestPayout}
              className="bg-green-600 hover:bg-green-500"
            >
              <DollarSign size={20} /> Solicitar Saque PIX
            </Button>
            {payoutLimit && (
              <p className="text-xs text-gray-500">
                {payoutLimit.remaining} de {payoutLimit.limit} saques restantes no mês
                {payoutLimit.isPro && <Crown size={12} className="inline ml-1 text-yellow-500" />}
              </p>
            )}
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-brand-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Payout Limits Info */}
      <Card>
        <CardHeader icon={<QrCode size={20} className="text-blue-500" />} title="Limites" />
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <span>{payoutLimit?.used || 0}/{payoutLimit?.limit || 4} saques usados</span>
            {payoutLimit?.isPro && <Crown size={14} className="text-yellow-500" />}
          </div>
          <span className="text-gray-500">Mín: {formatCurrency(balance?.minPayout || 2000)}</span>
        </div>
      </Card>

      {/* Payout History */}
      <Card>
        <h3 className="font-bold text-white mb-4">Histórico de Saques</h3>
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-dark-700">
              <th className="pb-3 font-medium">Data</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {payouts?.length ? (
              payouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="py-4 text-sm text-gray-300">{formatDate(payout.createdAt)}</td>
                  <td className="py-4">
                    <Badge variant={payout.status === 'completed' ? 'success' : payout.status === 'failed' ? 'error' : 'warning'}>
                      {payout.status === 'completed' ? 'Pago' : payout.status === 'failed' ? 'Falhou' : 'Processando'}
                    </Badge>
                  </td>
                  <td className="py-4 text-sm font-bold text-white text-right">{formatCurrency(payout.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-8 text-center text-gray-500">
                  Nenhum saque realizado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
