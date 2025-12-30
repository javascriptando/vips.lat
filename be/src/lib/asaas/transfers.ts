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

  // CPF: 11 dígitos
  if (cleaned.length === 11 && /^\d{11}$/.test(cleaned)) {
    return 'CPF';
  }

  // CNPJ: 14 dígitos
  if (cleaned.length === 14 && /^\d{14}$/.test(cleaned)) {
    return 'CNPJ';
  }

  // Telefone: +55 + DDD + número
  if (/^\+?55\d{10,11}$/.test(cleaned) || /^\d{10,11}$/.test(cleaned)) {
    return 'PHONE';
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)) {
    return 'EMAIL';
  }

  // EVP (chave aleatória): UUID format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pixKey)) {
    return 'EVP';
  }

  // Default para EVP se não identificado
  return 'EVP';
}
