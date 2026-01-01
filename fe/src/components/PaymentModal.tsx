import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button, ResponsiveModal } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaymentResponse } from '@/types';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  paymentData: PaymentResponse | null;
  title: string;
  description?: string;
}

export function PaymentModal({
  open,
  onClose,
  onSuccess,
  paymentData,
  title,
  description,
}: PaymentModalProps) {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'expired' | 'failed'>('pending');
  const [copied, setCopied] = useState(false);

  // Poll for payment status
  useEffect(() => {
    if (!open || !paymentData?.payment?.id || status !== 'pending') return;

    const checkStatus = async () => {
      try {
        const result = await api.getPaymentStatus(paymentData.payment.id);
        if (result.status === 'confirmed') {
          setStatus('confirmed');
          toast.success('Pagamento confirmado!');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        } else if (result.status === 'expired') {
          setStatus('expired');
        } else if (result.status === 'failed') {
          setStatus('failed');
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };

    // Check immediately and then every 3 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, [open, paymentData?.payment?.id, status, onSuccess, onClose]);

  // Reset status when modal opens with new payment
  useEffect(() => {
    if (open && paymentData) {
      setStatus('pending');
      setCopied(false);
    }
  }, [open, paymentData?.payment?.id]);

  const handleCopyCode = useCallback(async () => {
    if (!paymentData?.qrCode?.payload) return;

    const textToCopy = paymentData.qrCode.payload;

    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        toast.success('Código PIX copiado!');
        setTimeout(() => setCopied(false), 3000);
        return;
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback for HTTP or older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setCopied(true);
        toast.success('Código PIX copiado!');
        setTimeout(() => setCopied(false), 3000);
      } else {
        toast.error('Não foi possível copiar');
      }
    } catch {
      toast.error('Erro ao copiar código');
    }
  }, [paymentData?.qrCode?.payload]);

  if (!paymentData) return null;

  return (
    <ResponsiveModal
      open={open}
      onClose={status === 'pending' ? onClose : () => {}}
      title={title}
      size="md"
      showCloseButton={status === 'pending'}
    >
      <div className="space-y-6">
        {/* Status Banner */}
        {status === 'confirmed' && (
          <div className="flex items-center gap-3 p-4 bg-green-500/20 border border-green-500/30 rounded-xl">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-bold text-green-400">Pagamento Confirmado!</p>
              <p className="text-sm text-green-300">Seu conteúdo foi desbloqueado.</p>
            </div>
          </div>
        )}

        {status === 'expired' && (
          <div className="flex items-center gap-3 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
            <Clock className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="font-bold text-yellow-400">QR Code Expirado</p>
              <p className="text-sm text-yellow-300">Feche e tente novamente.</p>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="font-bold text-red-400">Pagamento Falhou</p>
              <p className="text-sm text-red-300">Tente novamente.</p>
            </div>
          </div>
        )}

        {status === 'pending' && (
          <>
            {description && (
              <p className="text-gray-400 text-center">{description}</p>
            )}

            {/* Price Display */}
            <div className="text-center">
              <p className="text-sm text-gray-400">Total a pagar</p>
              <p className="text-4xl font-bold text-white">{formatCurrency(paymentData.total)}</p>
              <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
                <span>Valor: {formatCurrency(paymentData.amount)}</span>
                <span>Taxa PIX: {formatCurrency(paymentData.pixFee)}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-2xl">
                {paymentData.qrCode?.image ? (
                  <img
                    src={`data:image/png;base64,${paymentData.qrCode.image}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                ) : paymentData.qrCode?.payload ? (
                  <QRCodeSVG
                    value={paymentData.qrCode.payload}
                    size={192}
                    level="M"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Copy Code Button */}
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCopyCode();
              }}
              className="w-full"
            >
              {copied ? (
                <>
                  <CheckCircle size={18} className="mr-2 text-green-500" />
                  Código Copiado!
                </>
              ) : (
                <>
                  <Copy size={18} className="mr-2" />
                  Copiar Código PIX
                </>
              )}
            </Button>

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Aguardando pagamento...</span>
            </div>

            {/* Instructions */}
            <div className="space-y-2 text-sm text-gray-500">
              <p className="font-medium text-gray-400">Como pagar:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar com PIX</li>
                <li>Escaneie o QR Code ou cole o código</li>
                <li>Confirme o pagamento</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}

export default PaymentModal;
