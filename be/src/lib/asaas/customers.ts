import { asaas, type AsaasCustomer } from './client';

interface CreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj?: string;
  externalReference?: string;
}

export async function createCustomer(input: CreateCustomerInput): Promise<AsaasCustomer> {
  return asaas.post<AsaasCustomer>('/customers', {
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    externalReference: input.externalReference,
    notificationDisabled: true,
  });
}

export async function getCustomer(customerId: string): Promise<AsaasCustomer> {
  return asaas.get<AsaasCustomer>(`/customers/${customerId}`);
}

export async function updateCustomer(customerId: string, input: Partial<CreateCustomerInput>): Promise<AsaasCustomer> {
  return asaas.put<AsaasCustomer>(`/customers/${customerId}`, input);
}

export async function findCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const response = await asaas.get<{ data: AsaasCustomer[] }>(`/customers?email=${encodeURIComponent(email)}`);
  return response.data[0] || null;
}
