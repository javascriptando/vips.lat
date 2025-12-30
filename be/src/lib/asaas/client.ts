import { env } from '@/config/env';

const ASAAS_BASE_URL = env.ASAAS_SANDBOX
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://www.asaas.com/api/v3';

export class AsaasError extends Error {
  constructor(
    public statusCode: number,
    public errors: AsaasErrorDetail[]
  ) {
    super(errors.map((e) => e.description).join(', '));
    this.name = 'AsaasError';
  }
}

interface AsaasErrorDetail {
  code: string;
  description: string;
}

interface AsaasErrorResponse {
  errors: AsaasErrorDetail[];
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${ASAAS_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': env.ASAAS_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = (await response.json()) as AsaasErrorResponse;
    throw new AsaasError(response.status, errorData.errors || [{ code: 'UNKNOWN', description: 'Unknown error' }]);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

export const asaas = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};

// Types
export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  additionalEmails?: string;
  municipalInscription?: string;
  stateInscription?: string;
  observations?: string;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  netValue: number;
  status: string;
  dueDate: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  pixTransaction?: {
    payload: string;
    expirationDate: string;
  };
}

export interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export interface AsaasTransfer {
  id: string;
  value: number;
  status: 'PENDING' | 'BANK_PROCESSING' | 'DONE' | 'CANCELLED' | 'FAILED';
  transferDate: string;
  effectiveDate?: string;
  failReason?: string;
}
