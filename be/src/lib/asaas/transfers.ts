import { asaas, type AsaasTransfer } from './client';

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

interface TransferToPixInput {
  value: number; // em reais
  pixKey: string;
  pixKeyType: PixKeyType;
  description?: string;
  externalReference?: string;
}

export async function transferToPix(input: TransferToPixInput): Promise<AsaasTransfer> {
  return asaas.post<AsaasTransfer>('/transfers', {
    value: input.value,
    operationType: 'PIX',
    pixAddressKey: input.pixKey,
    pixAddressKeyType: input.pixKeyType,
    description: input.description,
    externalReference: input.externalReference,
  });
}

export async function getTransfer(transferId: string): Promise<AsaasTransfer> {
  return asaas.get<AsaasTransfer>(`/transfers/${transferId}`);
}

interface AccountBalance {
  balance: number;
}

export async function getAccountBalance(): Promise<number> {
  const response = await asaas.get<AccountBalance>('/finance/balance');
  return response.balance;
}

// Detectar tipo de chave PIX
export function detectPixKeyType(pixKey: string): PixKeyType {
  // Remove caracteres especiais para validação
  const cleaned = pixKey.replace(/\D/g, '');

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)) {
    return 'EMAIL';
  }

  // EVP (chave aleatória): UUID format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pixKey)) {
    return 'EVP';
  }

  // Telefone com +55 explícito
  if (pixKey.startsWith('+55') || pixKey.startsWith('+')) {
    return 'PHONE';
  }

  // CNPJ: 14 dígitos
  if (cleaned.length === 14) {
    return 'CNPJ';
  }

  // CPF: 11 dígitos (padrão para 11 dígitos numéricos)
  if (cleaned.length === 11) {
    return 'CPF';
  }

  // Telefone fixo: 10 dígitos (DDD + 8 dígitos)
  if (cleaned.length === 10) {
    return 'PHONE';
  }

  // Default para EVP se não identificado
  return 'EVP';
}
