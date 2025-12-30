import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Card, Avatar, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export function SubscribersList() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: subscribersData, isLoading } = useQuery({
    queryKey: ['mySubscribers'],
    queryFn: () => api.getMySubscribers(),
  });

  const subscribers = subscribersData?.data || [];

  const filteredSubs = subscribers.filter((sub: any) =>
    sub.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Assinantes</h1>
          <p className="text-gray-400">
            Gerencie sua comunidade ({subscribersData?.pagination?.total || 0}).
          </p>
        </div>
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Buscar assinante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-brand-500"
          />
        </div>
      </header>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-dark-900">
              <tr className="text-xs text-gray-400 uppercase">
                <th className="p-4 font-medium">Assinante</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Desde</th>
                <th className="p-4 font-medium text-right">Expira em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="p-4" colSpan={4}>
                      <div className="h-12 bg-dark-700 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredSubs.length > 0 ? (
                filteredSubs.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-dark-700/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={sub.avatarUrl} name={sub.name} />
                        <div>
                          <p className="text-sm font-bold text-white">{sub.name || 'Usuário'}</p>
                          <p className="text-xs text-gray-500">@{sub.username || 'user'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          sub.status === 'active'
                            ? 'success'
                            : sub.status === 'cancelled'
                            ? 'error'
                            : 'default'
                        }
                      >
                        {sub.status === 'active'
                          ? 'Ativo'
                          : sub.status === 'cancelled'
                          ? 'Cancelou'
                          : 'Expirado'}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {sub.startsAt ? formatDate(sub.startsAt) : '-'}
                    </td>
                    <td className="p-4 text-sm text-gray-400 text-right">
                      {sub.expiresAt ? formatDate(sub.expiresAt) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Users size={48} className="mx-auto mb-4 text-dark-500" />
                    <p className="text-gray-400">
                      {searchQuery ? 'Nenhum assinante encontrado.' : 'Você ainda não tem assinantes.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
