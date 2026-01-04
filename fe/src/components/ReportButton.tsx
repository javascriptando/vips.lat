import { useState } from 'react';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui';

type ReportReason = 'illegal_content' | 'underage' | 'harassment' | 'spam' | 'copyright' | 'impersonation' | 'fraud' | 'other';

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'illegal_content', label: 'Conteúdo ilegal', description: 'Conteúdo que viola leis' },
  { value: 'underage', label: 'Menor de idade', description: 'Conteúdo envolvendo menores' },
  { value: 'harassment', label: 'Assédio/Bullying', description: 'Comportamento abusivo ou ameaçador' },
  { value: 'spam', label: 'Spam', description: 'Mensagens ou conteúdo repetitivo indesejado' },
  { value: 'copyright', label: 'Violação de direitos autorais', description: 'Uso não autorizado de conteúdo protegido' },
  { value: 'impersonation', label: 'Falsidade ideológica', description: 'Se passando por outra pessoa' },
  { value: 'fraud', label: 'Fraude/Golpe', description: 'Tentativa de enganar ou roubar' },
  { value: 'other', label: 'Outro', description: 'Outro motivo não listado' },
];

interface ReportButtonProps {
  targetType: 'content' | 'creator' | 'message' | 'comment';
  targetId: string;
  variant?: 'icon' | 'text' | 'menu';
  className?: string;
}

export function ReportButton({ targetType, targetId, variant = 'icon', className = '' }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [description, setDescription] = useState('');

  const submitReport = useMutation({
    mutationFn: () => api.createReport({
      targetType,
      targetId,
      reason: reason as ReportReason,
      description: description || undefined,
    }),
    onSuccess: () => {
      toast.success('Denúncia enviada. Nossa equipe irá analisar.');
      setIsOpen(false);
      setReason('');
      setDescription('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Selecione um motivo para a denúncia');
      return;
    }
    submitReport.mutate();
  };

  const targetLabel = {
    content: 'este conteúdo',
    creator: 'este perfil',
    message: 'esta mensagem',
    comment: 'este comentário',
  }[targetType];

  return (
    <>
      {variant === 'icon' && (
        <button
          onClick={() => setIsOpen(true)}
          className={`p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ${className}`}
          title="Denunciar"
        >
          <Flag size={18} />
        </button>
      )}

      {variant === 'text' && (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors text-sm ${className}`}
        >
          <Flag size={16} />
          <span>Denunciar</span>
        </button>
      )}

      {variant === 'menu' && (
        <button
          onClick={() => setIsOpen(true)}
          className={`w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors ${className}`}
        >
          <Flag size={18} />
          <span>Denunciar</span>
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md max-h-[40vh] overflow-y-auto animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="text-red-500" size={20} />
                </div>
                <h2 className="text-lg font-semibold text-white">Denunciar</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <p className="text-sm text-gray-400">
                Por que você está denunciando {targetLabel}?
              </p>

              {/* Reason Selection */}
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      reason === r.value
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-dark-700 hover:border-dark-600 bg-dark-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value as ReportReason)}
                      className="mt-1 accent-red-500"
                    />
                    <div>
                      <p className="text-white text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-gray-500">{r.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">
                  Detalhes adicionais (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Descreva o problema com mais detalhes..."
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 transition-all resize-none"
                />
              </div>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-xs text-yellow-200">
                  Denúncias falsas podem resultar em penalidades para sua conta. Use este recurso apenas para problemas reais.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  isLoading={submitReport.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={!reason}
                >
                  Enviar Denúncia
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
