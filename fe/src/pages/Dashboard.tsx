import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Users, Eye, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';

export function Dashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['creatorStats'],
    queryFn: () => api.getCreatorStats(),
  });

  const { data: earnings } = useQuery({
    queryKey: ['earnings'],
    queryFn: () => api.getMyEarnings(),
  });

  // Generate chart data from transactions (last 7 days)
  const chartData = useMemo(() => {
    if (!earnings?.transactions?.length) return [];

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const now = new Date();
    const last7Days: Record<string, number> = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      last7Days[key] = 0;
    }

    // Sum earnings by day
    earnings.transactions.forEach((tx) => {
      const txDate = new Date(tx.createdAt || '').toISOString().split('T')[0];
      if (last7Days[txDate] !== undefined) {
        last7Days[txDate] += tx.creatorAmount || 0;
      }
    });

    return Object.entries(last7Days).map(([date, value]) => ({
      name: days[new Date(date).getDay()],
      value: value / 100, // Convert from cents to reais for display
    }));
  }, [earnings?.transactions]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-dark-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-dark-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Visão geral do seu desempenho.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Ganhos Totais</p>
          <h3 className="text-2xl font-bold text-white">{formatCurrency(stats?.totalEarnings || 0)}</h3>
        </Card>

        <Card>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-brand-500/10 text-brand-500 rounded-xl">
              <Users size={24} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Assinantes Ativos</p>
          <h3 className="text-2xl font-bold text-white">{stats?.activeSubscribers || 0}</h3>
        </Card>

        <Card>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Eye size={24} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Visualizações</p>
          <h3 className="text-2xl font-bold text-white">{formatNumber(stats?.totalViews || 0)}</h3>
        </Card>

        <Card>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Wallet size={24} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Saldo Disponível</p>
          <h3 className="text-2xl font-bold text-white">{formatCurrency(stats?.availableBalance || 0)}</h3>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="font-bold text-white mb-6">Rendimento Semanal</h3>
          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} />
                  <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Ganhos']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <p>Sem transações para exibir no gráfico</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-bold text-white mb-4">Últimas Transações</h3>
          <div className="space-y-4">
            {earnings?.transactions?.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-dark-900/50">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      tx.type === 'subscription' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                    }`}
                  >
                    {tx.type === 'subscription' ? <Users size={16} /> : <DollarSign size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {tx.type === 'subscription' ? 'Assinatura' : tx.type === 'tip' ? 'Gorjeta' : 'PPV'}
                    </p>
                    <p className="text-xs text-gray-500">{tx.type}</p>
                  </div>
                </div>
                <span className="font-bold text-white text-sm">+{formatCurrency(tx.creatorAmount)}</span>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-4">Nenhuma transação ainda</p>
            )}
          </div>
          <button
            onClick={() => navigate('/earnings')}
            className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-700 rounded-lg transition-colors"
          >
            Ver Extrato Completo
          </button>
        </Card>
      </div>
    </div>
  );
}
