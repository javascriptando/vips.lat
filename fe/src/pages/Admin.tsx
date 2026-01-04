import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Shield,
  Flag,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Eye,
  Ban,
  Unlock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

type Tab = 'overview' | 'kyc' | 'reports' | 'users' | 'creators' | 'fraud';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Visão Geral', icon: <LayoutDashboard size={18} /> },
  { id: 'kyc', label: 'Verificação KYC', icon: <UserCheck size={18} /> },
  { id: 'reports', label: 'Denúncias', icon: <Flag size={18} /> },
  { id: 'users', label: 'Usuários', icon: <Users size={18} /> },
  { id: 'creators', label: 'Criadores', icon: <Shield size={18} /> },
  { id: 'fraud', label: 'Fraude', icon: <AlertTriangle size={18} /> },
];

const REPORT_REASONS: Record<string, string> = {
  illegal_content: 'Conteúdo ilegal',
  underage: 'Menor de idade',
  harassment: 'Assédio',
  spam: 'Spam',
  copyright: 'Direitos autorais',
  impersonation: 'Falsidade ideológica',
  fraud: 'Fraude',
  other: 'Outro',
};

export function Admin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [kycPage, setKycPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [creatorsPage, setCreatorsPage] = useState(1);
  const [fraudPage, setFraudPage] = useState(1);

  // Modal states
  const [selectedKyc, setSelectedKyc] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [kycRejectReason, setKycRejectReason] = useState('');
  const [reportAction, setReportAction] = useState<string>('');
  const [reportNotes, setReportNotes] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.getAdminStats(),
  });

  const { data: kycList } = useQuery({
    queryKey: ['admin-kyc', kycPage],
    queryFn: () => api.getAdminKycList({ page: kycPage, pageSize: 10, status: 'pending' }),
    enabled: activeTab === 'kyc' || activeTab === 'overview',
  });

  const { data: kycDetail } = useQuery({
    queryKey: ['admin-kyc-detail', selectedKyc],
    queryFn: () => api.getAdminKycDetail(selectedKyc!),
    enabled: !!selectedKyc,
  });

  const { data: reportsList } = useQuery({
    queryKey: ['admin-reports', reportsPage],
    queryFn: () => api.getAdminReports({ page: reportsPage, pageSize: 10, status: 'pending' }),
    enabled: activeTab === 'reports' || activeTab === 'overview',
  });

  const { data: usersList } = useQuery({
    queryKey: ['admin-users', usersPage],
    queryFn: () => api.getAdminUsers({ page: usersPage, pageSize: 10 }),
    enabled: activeTab === 'users',
  });

  const { data: creatorsList } = useQuery({
    queryKey: ['admin-creators', creatorsPage],
    queryFn: () => api.getAdminCreators({ page: creatorsPage, pageSize: 10 }),
    enabled: activeTab === 'creators',
  });

  const { data: fraudList } = useQuery({
    queryKey: ['admin-fraud', fraudPage],
    queryFn: () => api.getAdminFraudFlags({ page: fraudPage, pageSize: 10, status: 'open' }),
    enabled: activeTab === 'fraud' || activeTab === 'overview',
  });

  // Mutations
  const reviewKyc = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'approved' | 'rejected'; reason?: string }) =>
      api.reviewKyc(id, status, reason),
    onSuccess: () => {
      toast.success('KYC processado com sucesso');
      setSelectedKyc(null);
      setKycRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-kyc'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviewReport = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: string; notes?: string }) =>
      api.reviewReport(id, { action: action as 'dismissed' | 'warning_issued' | 'content_removed' | 'creator_suspended' | 'user_banned', notes }),
    onSuccess: () => {
      toast.success('Denúncia processada com sucesso');
      setSelectedReport(null);
      setReportAction('');
      setReportNotes('');
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const suspendUser = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.suspendUser(id, { type: 'temporary', reason, durationDays: 7 }),
    onSuccess: () => {
      toast.success('Usuário suspenso');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unsuspendUser = useMutation({
    mutationFn: ({ id }: { id: string }) => api.unsuspendUser(id, 'Suspensão removida pelo admin'),
    onSuccess: () => {
      toast.success('Suspensão removida');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const blockPayouts = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.blockCreatorPayouts(id, reason),
    onSuccess: () => {
      toast.success('Saques bloqueados');
      queryClient.invalidateQueries({ queryKey: ['admin-creators'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unblockPayouts = useMutation({
    mutationFn: ({ id }: { id: string }) => api.unblockCreatorPayouts(id),
    onSuccess: () => {
      toast.success('Saques desbloqueados');
      queryClient.invalidateQueries({ queryKey: ['admin-creators'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resolveFraud = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) => api.resolveFraudFlag(id, resolution),
    onSuccess: () => {
      toast.success('Flag resolvida');
      queryClient.invalidateQueries({ queryKey: ['admin-fraud'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const renderPagination = (
    current: number,
    total: number,
    onPrev: () => void,
    onNext: () => void
  ) => (
    <div className="flex items-center justify-between mt-4 px-2">
      <span className="text-sm text-gray-400">Página {current} de {total}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onPrev} disabled={current <= 1}>
          <ChevronLeft size={16} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onNext} disabled={current >= total}>
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white'
                : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'kyc' && stats?.pendingKyc ? (
              <span className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full">
                {stats.pendingKyc}
              </span>
            ) : null}
            {tab.id === 'reports' && stats?.pendingReports ? (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {stats.pendingReports}
              </span>
            ) : null}
            {tab.id === 'fraud' && stats?.openFraudFlags ? (
              <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {stats.openFraudFlags}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center">
              <Users className="mx-auto mb-2 text-blue-500" size={24} />
              <p className="text-2xl font-bold text-white">{stats?.usersTotal || 0}</p>
              <p className="text-xs text-gray-400">Usuários</p>
            </Card>
            <Card className="text-center">
              <Shield className="mx-auto mb-2 text-purple-500" size={24} />
              <p className="text-2xl font-bold text-white">{stats?.creatorsTotal || 0}</p>
              <p className="text-xs text-gray-400">Criadores</p>
            </Card>
            <Card className="text-center">
              <Clock className="mx-auto mb-2 text-yellow-500" size={24} />
              <p className="text-2xl font-bold text-white">{stats?.pendingKyc || 0}</p>
              <p className="text-xs text-gray-400">KYC Pendentes</p>
            </Card>
            <Card className="text-center">
              <Flag className="mx-auto mb-2 text-red-500" size={24} />
              <p className="text-2xl font-bold text-white">{stats?.pendingReports || 0}</p>
              <p className="text-xs text-gray-400">Denúncias</p>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="text-center">
              <AlertTriangle className="mx-auto mb-2 text-orange-500" size={24} />
              <p className="text-2xl font-bold text-white">{stats?.openFraudFlags || 0}</p>
              <p className="text-xs text-gray-400">Flags de Fraude</p>
            </Card>
            <Card className="text-center">
              <Flag className="mx-auto mb-2 text-red-600" size={24} />
              <p className="text-2xl font-bold text-white">{stats?.pendingReportsHighPriority || 0}</p>
              <p className="text-xs text-gray-400">Denúncias Urgentes</p>
            </Card>
            <Card className="text-center">
              <DollarSign className="mx-auto mb-2 text-green-500" size={24} />
              <p className="text-2xl font-bold text-white">{formatCurrency(stats?.revenue30Days || 0)}</p>
              <p className="text-xs text-gray-400">Receita 30 dias</p>
            </Card>
          </div>
        </div>
      )}

      {/* KYC Tab */}
      {activeTab === 'kyc' && (
        <Card>
          <CardHeader icon={<UserCheck size={20} className="text-yellow-500" />} title="Verificações KYC Pendentes" />

          {kycList?.data && kycList.data.length > 0 ? (
            <div className="space-y-3">
              {kycList.data.map((kyc) => (
                <div
                  key={kyc.id}
                  className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"
                >
                  <div>
                    <p className="font-medium text-white">{kyc.fullName}</p>
                    <p className="text-sm text-gray-400">@{kyc.creatorUsername} - {kyc.documentType.toUpperCase()}</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(kyc.createdAt)}</p>
                  </div>
                  <Button size="sm" onClick={() => setSelectedKyc(kyc.id)}>
                    <Eye size={16} /> Revisar
                  </Button>
                </div>
              ))}
              {kycList.pagination && renderPagination(
                kycList.pagination.page,
                kycList.pagination.totalPages,
                () => setKycPage((p) => Math.max(1, p - 1)),
                () => setKycPage((p) => p + 1)
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Nenhuma verificação pendente.</p>
          )}
        </Card>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <Card>
          <CardHeader icon={<Flag size={20} className="text-red-500" />} title="Denúncias Pendentes" />

          {reportsList?.data && reportsList.data.length > 0 ? (
            <div className="space-y-3">
              {reportsList.data.map((report) => (
                <div
                  key={report.id}
                  className={`flex items-center justify-between p-4 bg-dark-900 rounded-lg border ${
                    report.priority >= 8 ? 'border-red-500' : report.priority >= 5 ? 'border-yellow-500' : 'border-dark-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        report.priority >= 8 ? 'bg-red-500/20 text-red-400' :
                        report.priority >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        P{report.priority}
                      </span>
                      <span className="text-white font-medium">{REPORT_REASONS[report.reason] || report.reason}</span>
                    </div>
                    <p className="text-sm text-gray-400">Tipo: {report.targetType} - Por: @{report.reporterUsername}</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(report.createdAt)}</p>
                  </div>
                  <Button size="sm" onClick={() => setSelectedReport(report.id)}>
                    <Eye size={16} /> Revisar
                  </Button>
                </div>
              ))}
              {reportsList.pagination && renderPagination(
                reportsList.pagination.page,
                reportsList.pagination.totalPages,
                () => setReportsPage((p) => Math.max(1, p - 1)),
                () => setReportsPage((p) => p + 1)
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Nenhuma denúncia pendente.</p>
          )}
        </Card>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader icon={<Users size={20} className="text-blue-500" />} title="Usuários" />

          {usersList?.data && usersList.data.length > 0 ? (
            <div className="space-y-3">
              {usersList.data.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{user.name || user.username}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                        user.role === 'creator' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {user.role}
                      </span>
                      {user.isSuspended && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">Suspenso</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">@{user.username} - {user.email}</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(user.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    {user.isSuspended ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unsuspendUser.mutate({ id: user.id })}
                        isLoading={unsuspendUser.isPending}
                      >
                        <Unlock size={16} /> Reativar
                      </Button>
                    ) : user.role !== 'admin' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => {
                          const reason = prompt('Motivo da suspensão:');
                          if (reason) suspendUser.mutate({ id: user.id, reason });
                        }}
                        isLoading={suspendUser.isPending}
                      >
                        <Ban size={16} /> Suspender
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {usersList.pagination && renderPagination(
                usersList.pagination.page,
                usersList.pagination.totalPages,
                () => setUsersPage((p) => Math.max(1, p - 1)),
                () => setUsersPage((p) => p + 1)
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Nenhum usuário encontrado.</p>
          )}
        </Card>
      )}

      {/* Creators Tab */}
      {activeTab === 'creators' && (
        <Card>
          <CardHeader icon={<Shield size={20} className="text-purple-500" />} title="Criadores" />

          {creatorsList?.data && creatorsList.data.length > 0 ? (
            <div className="space-y-3">
              {creatorsList.data.map((creator) => (
                <div
                  key={creator.id}
                  className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{creator.displayName}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        creator.kycStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                        creator.kycStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        creator.kycStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        KYC: {creator.kycStatus}
                      </span>
                      {creator.payoutsBlocked && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">Saques bloqueados</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">@{creator.username} - {creator.subscriberCount} assinantes</p>
                  </div>
                  <div className="flex gap-2">
                    {creator.payoutsBlocked ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unblockPayouts.mutate({ id: creator.id })}
                        isLoading={unblockPayouts.isPending}
                      >
                        <Unlock size={16} /> Desbloquear
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => {
                          const reason = prompt('Motivo do bloqueio:');
                          if (reason) blockPayouts.mutate({ id: creator.id, reason });
                        }}
                        isLoading={blockPayouts.isPending}
                      >
                        <Ban size={16} /> Bloquear Saques
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {creatorsList.pagination && renderPagination(
                creatorsList.pagination.page,
                creatorsList.pagination.totalPages,
                () => setCreatorsPage((p) => Math.max(1, p - 1)),
                () => setCreatorsPage((p) => p + 1)
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Nenhum criador encontrado.</p>
          )}
        </Card>
      )}

      {/* Fraud Tab */}
      {activeTab === 'fraud' && (
        <Card>
          <CardHeader icon={<AlertTriangle size={20} className="text-orange-500" />} title="Flags de Fraude" />

          {fraudList?.data && fraudList.data.length > 0 ? (
            <div className="space-y-3">
              {fraudList.data.map((flag) => (
                <div
                  key={flag.id}
                  className={`flex items-center justify-between p-4 bg-dark-900 rounded-lg border ${
                    flag.severity >= 4 ? 'border-red-500' : flag.severity >= 2 ? 'border-yellow-500' : 'border-dark-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        flag.severity >= 4 ? 'bg-red-500/20 text-red-400' :
                        flag.severity >= 2 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        Sev: {flag.severity}
                      </span>
                      <span className="text-white font-medium">{flag.type}</span>
                    </div>
                    <p className="text-sm text-gray-400">{flag.description}</p>
                    {flag.creatorDisplayName && (
                      <p className="text-xs text-gray-500">Criador: {flag.creatorDisplayName}</p>
                    )}
                    <p className="text-xs text-gray-500">{formatRelativeTime(flag.createdAt)}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const resolution = prompt('Resolução:');
                      if (resolution) resolveFraud.mutate({ id: flag.id, resolution });
                    }}
                    isLoading={resolveFraud.isPending}
                  >
                    <CheckCircle size={16} /> Resolver
                  </Button>
                </div>
              ))}
              {fraudList.pagination && renderPagination(
                fraudList.pagination.page,
                fraudList.pagination.totalPages,
                () => setFraudPage((p) => Math.max(1, p - 1)),
                () => setFraudPage((p) => p + 1)
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Nenhuma flag de fraude aberta.</p>
          )}
        </Card>
      )}

      {/* KYC Review Modal */}
      {selectedKyc && kycDetail?.kyc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedKyc(null)} />
          <div className="relative bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Revisão KYC</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Nome</p>
                  <p className="text-white">{kycDetail.kyc.fullName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">CPF/Documento</p>
                  <p className="text-white font-mono">{kycDetail.kyc.documentNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Data de Nascimento</p>
                  <p className="text-white">{kycDetail.kyc.birthDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Tipo de Documento</p>
                  <p className="text-white">{kycDetail.kyc.documentType.toUpperCase()}</p>
                </div>
              </div>

              <p className="text-xs text-gray-400">Clique nas imagens para ampliar</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-2">Documento (Frente)</p>
                  <img
                    src={kycDetail.kyc.documentFrontUrl}
                    alt="Documento Frente"
                    className="w-full h-40 object-cover rounded-lg border border-dark-600 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setZoomedImage(kycDetail.kyc.documentFrontUrl)}
                  />
                </div>
                {kycDetail.kyc.documentBackUrl && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Documento (Verso)</p>
                    <img
                      src={kycDetail.kyc.documentBackUrl}
                      alt="Documento Verso"
                      className="w-full h-40 object-cover rounded-lg border border-dark-600 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setZoomedImage(kycDetail.kyc.documentBackUrl!)}
                    />
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Selfie</p>
                  <img
                    src={kycDetail.kyc.selfieUrl}
                    alt="Selfie"
                    className="w-full h-40 object-cover rounded-lg border border-dark-600 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setZoomedImage(kycDetail.kyc.selfieUrl)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">Motivo da rejeição (se aplicável)</label>
                <textarea
                  value={kycRejectReason}
                  onChange={(e) => setKycRejectReason(e.target.value)}
                  className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white text-sm"
                  rows={2}
                  placeholder="Documento ilegível, foto não confere, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={() => setSelectedKyc(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 text-red-400 hover:text-red-300"
                  onClick={() => {
                    if (!kycRejectReason) {
                      toast.error('Informe o motivo da rejeição');
                      return;
                    }
                    reviewKyc.mutate({ id: selectedKyc, status: 'rejected', reason: kycRejectReason });
                  }}
                  isLoading={reviewKyc.isPending}
                >
                  <XCircle size={16} /> Rejeitar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => reviewKyc.mutate({ id: selectedKyc, status: 'approved' })}
                  isLoading={reviewKyc.isPending}
                >
                  <CheckCircle size={16} /> Aprovar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedReport(null)} />
          <div className="relative bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md">
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Processar Denúncia</h2>

              <div>
                <label className="text-xs text-gray-400">Ação</label>
                <select
                  value={reportAction}
                  onChange={(e) => setReportAction(e.target.value)}
                  className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white"
                >
                  <option value="">Selecione uma ação</option>
                  <option value="dismissed">Arquivar (sem violação)</option>
                  <option value="warning_issued">Enviar advertência</option>
                  <option value="content_removed">Remover conteúdo</option>
                  <option value="creator_suspended">Suspender criador</option>
                  <option value="user_banned">Banir usuário</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Notas (opcional)</label>
                <textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white text-sm"
                  rows={2}
                  placeholder="Observações sobre a decisão..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={() => setSelectedReport(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!reportAction) {
                      toast.error('Selecione uma ação');
                      return;
                    }
                    reviewReport.mutate({ id: selectedReport, action: reportAction, notes: reportNotes });
                  }}
                  isLoading={reviewReport.isPending}
                  className="flex-1"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90"
          onClick={() => setZoomedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-xl p-2 hover:bg-white/10 rounded-full"
            onClick={() => setZoomedImage(null)}
          >
            ✕
          </button>
          <img
            src={zoomedImage}
            alt="Documento ampliado"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
