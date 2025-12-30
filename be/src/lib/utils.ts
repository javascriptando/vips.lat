import { nanoid } from 'nanoid';
import { FEES } from '@/config/constants';

// Gerar ID único
export function generateId(size = 21): string {
  return nanoid(size);
}

// Gerar slug a partir de string
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Tipo de pagamento
export type PaymentType = 'subscription' | 'ppv' | 'tip' | 'pro_plan';

// Cálculo de fees
export interface FeeCalculation {
  amount: number;        // valor base (centavos)
  pixFee: number;        // taxa pix
  platformFee: number;   // fee plataforma
  creatorAmount: number; // líquido criador
  totalCharged: number;  // total cobrado do cliente
}

export function calculateFees(amount: number, type: PaymentType): FeeCalculation {
  const pixFee = FEES.PIX_FEE;

  if (type === 'pro_plan') {
    return {
      amount,
      pixFee,
      platformFee: amount,
      creatorAmount: 0,
      totalCharged: amount + pixFee,
    };
  }

  const platformRate = type === 'tip'
    ? FEES.PLATFORM_FEE_TIP
    : FEES.PLATFORM_FEE_SUBSCRIPTION;

  const platformFee = Math.round(amount * platformRate);
  const creatorAmount = amount - platformFee;

  return {
    amount,
    pixFee,
    platformFee,
    creatorAmount,
    totalCharged: amount + pixFee,
  };
}

// Formatar valor em centavos para reais
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// Converter reais para centavos
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

// Converter centavos para reais
export function toReais(cents: number): number {
  return cents / 100;
}

// Validar CPF
export function isValidCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '');

  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(10))) return false;

  return true;
}

// Validar CNPJ
export function isValidCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '');

  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let size = cnpj.length - 2;
  let numbers = cnpj.substring(0, size);
  const digits = cnpj.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cnpj.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

// Validar CPF ou CNPJ
export function isValidCpfCnpj(value: string): boolean {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) return isValidCPF(cleaned);
  if (cleaned.length === 14) return isValidCNPJ(cleaned);
  return false;
}

// Formatar CPF
export function formatCPF(cpf: string): string {
  cpf = cpf.replace(/\D/g, '');
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Formatar CNPJ
export function formatCNPJ(cnpj: string): string {
  cnpj = cnpj.replace(/\D/g, '');
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// Data de hoje no formato YYYY-MM-DD
export function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Data de amanhã no formato YYYY-MM-DD
export function tomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}
