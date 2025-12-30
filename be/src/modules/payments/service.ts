import { db } from '@/db';
import { payments, subscriptions, contents, contentPurchases, creators, balances, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createPixPayment, createCustomer, findCustomerByEmail, updateCustomer } from '@/lib/asaas';
import { calculateFees, toReais, formatCurrency } from '@/lib/utils';
import { LIMITS } from '@/config/constants';
import { sendEmail, paymentConfirmedTemplate } from '@/lib/email';
import * as subscriptionService from '@/modules/subscriptions/service';
import type { ListPaymentsInput } from './schemas';

export async function ensureAsaasCustomer(userId: string, cpfCnpj?: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error('Usuário não encontrado');

  // Se recebeu CPF novo, salva no usuário (opcional para pagantes)
  const userCpfCnpj = cpfCnpj || user.cpfCnpj || undefined;

  if (cpfCnpj && cpfCnpj !== user.cpfCnpj) {
    await db.update(users).set({ cpfCnpj, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  // Se já tem customer ID, retorna
  if (user.asaasCustomerId) {
    // Se agora tem CPF e antes não tinha, atualiza no Asaas
    if (cpfCnpj && !user.cpfCnpj) {
      await updateCustomer(user.asaasCustomerId, { cpfCnpj });
    }
    return user.asaasCustomerId;
  }

  // Verificar se já existe no Asaas
  let customer = await findCustomerByEmail(user.email);

  if (customer) {
    // Atualizar CPF se fornecido
    if (cpfCnpj && !customer.cpfCnpj) {
      await updateCustomer(customer.id, { cpfCnpj });
    }
  } else {
    // Criar customer sem CPF (opcional para quem paga, obrigatório só para quem recebe)
    customer = await createCustomer({
      name: user.name || user.email.split('@')[0],
      email: user.email,
      cpfCnpj: userCpfCnpj, // pode ser undefined
      externalReference: userId,
    });
  }

  // Salvar ID
  await db.update(users).set({ asaasCustomerId: customer.id }).where(eq(users.id, userId));

  return customer.id;
}

export async function createSubscriptionPayment(
  userId: string,
  creatorId: string,
  duration: '1' | '3' | '6' | '12' = '1',
  cpfCnpj?: string
) {
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });
  if (!creator) throw new Error('Criador não encontrado');

  // Verificar se já tem assinatura ativa
  const existing = await subscriptionService.getActiveSubscription(userId, creatorId);
  if (existing) {
    throw new Error('Você já possui uma assinatura ativa com este criador');
  }

  // Calcular preço baseado na duração (com desconto)
  const totalPrice = subscriptionService.calculateSubscriptionPrice(creator.subscriptionPrice, duration);

  // Calcular fees
  const fees = calculateFees(totalPrice, 'subscription');

  // Garantir customer no Asaas (CPF opcional para quem paga)
  const customerId = await ensureAsaasCustomer(userId, cpfCnpj);

  // Criar pagamento no banco
  const [payment] = await db
    .insert(payments)
    .values({
      payerId: userId,
      creatorId,
      type: 'subscription',
      amount: fees.amount,
      pixFee: fees.pixFee,
      platformFee: fees.platformFee,
      creatorAmount: fees.creatorAmount,
      description: `Assinatura ${duration} mês(es) - ${creator.displayName}`,
      status: 'pending',
      metadata: { duration }, // Guardar duração para usar na confirmação
    })
    .returning();

  // Criar cobrança no Asaas
  const { payment: asaasPayment, qrCode } = await createPixPayment({
    customerId,
    value: toReais(fees.totalCharged),
    description: `Assinatura VIPS - ${creator.displayName}`,
    externalReference: payment.id,
  });

  // Atualizar pagamento com dados do Asaas
  const [updatedPayment] = await db
    .update(payments)
    .set({
      asaasPaymentId: asaasPayment.id,
      asaasPixQrCode: qrCode.payload,
      asaasPixQrCodeImage: qrCode.encodedImage,
      asaasPixExpiresAt: new Date(qrCode.expirationDate),
    })
    .where(eq(payments.id, payment.id))
    .returning();

  // Obter planos para exibição
  const plans = subscriptionService.getSubscriptionPlans(creator.subscriptionPrice);

  return {
    payment: updatedPayment,
    qrCode: {
      payload: qrCode.payload,
      image: qrCode.encodedImage,
      expiresAt: qrCode.expirationDate,
    },
    amount: fees.amount,
    pixFee: fees.pixFee,
    total: fees.totalCharged,
    duration,
    plans,
  };
}

export async function createPPVPayment(userId: string, contentId: string, cpfCnpj?: string) {
  const content = await db.query.contents.findFirst({ where: eq(contents.id, contentId) });
  if (!content) throw new Error('Conteúdo não encontrado');
  if (content.visibility !== 'ppv' || !content.ppvPrice) {
    throw new Error('Este conteúdo não é PPV');
  }

  // Verificar se já comprou
  const existing = await db.query.contentPurchases.findFirst({
    where: and(eq(contentPurchases.userId, userId), eq(contentPurchases.contentId, contentId)),
  });
  if (existing) throw new Error('Você já comprou este conteúdo');

  const creator = await db.query.creators.findFirst({ where: eq(creators.id, content.creatorId) });
  if (!creator) throw new Error('Criador não encontrado');

  const fees = calculateFees(content.ppvPrice, 'ppv');
  const customerId = await ensureAsaasCustomer(userId, cpfCnpj);

  const [payment] = await db
    .insert(payments)
    .values({
      payerId: userId,
      creatorId: content.creatorId,
      contentId,
      type: 'ppv',
      amount: fees.amount,
      pixFee: fees.pixFee,
      platformFee: fees.platformFee,
      creatorAmount: fees.creatorAmount,
      description: `Conteúdo PPV - ${creator.displayName}`,
      status: 'pending',
    })
    .returning();

  const { payment: asaasPayment, qrCode } = await createPixPayment({
    customerId,
    value: toReais(fees.totalCharged),
    description: `Conteúdo PPV VIPS`,
    externalReference: payment.id,
  });

  const [updatedPayment] = await db
    .update(payments)
    .set({
      asaasPaymentId: asaasPayment.id,
      asaasPixQrCode: qrCode.payload,
      asaasPixQrCodeImage: qrCode.encodedImage,
      asaasPixExpiresAt: new Date(qrCode.expirationDate),
    })
    .where(eq(payments.id, payment.id))
    .returning();

  return {
    payment: updatedPayment,
    qrCode: { payload: qrCode.payload, image: qrCode.encodedImage, expiresAt: qrCode.expirationDate },
    amount: fees.amount,
    pixFee: fees.pixFee,
    total: fees.totalCharged,
  };
}

export async function createTipPayment(userId: string, creatorId: string, amount: number, message?: string, cpfCnpj?: string) {
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });
  if (!creator) throw new Error('Criador não encontrado');

  const fees = calculateFees(amount, 'tip');
  const customerId = await ensureAsaasCustomer(userId, cpfCnpj);

  const [payment] = await db
    .insert(payments)
    .values({
      payerId: userId,
      creatorId,
      type: 'tip',
      amount: fees.amount,
      pixFee: fees.pixFee,
      platformFee: fees.platformFee,
      creatorAmount: fees.creatorAmount,
      description: message || `Gorjeta para ${creator.displayName}`,
      status: 'pending',
    })
    .returning();

  const { payment: asaasPayment, qrCode } = await createPixPayment({
    customerId,
    value: toReais(fees.totalCharged),
    description: `Gorjeta VIPS - ${creator.displayName}`,
    externalReference: payment.id,
  });

  const [updatedPayment] = await db
    .update(payments)
    .set({
      asaasPaymentId: asaasPayment.id,
      asaasPixQrCode: qrCode.payload,
      asaasPixQrCodeImage: qrCode.encodedImage,
      asaasPixExpiresAt: new Date(qrCode.expirationDate),
    })
    .where(eq(payments.id, payment.id))
    .returning();

  return {
    payment: updatedPayment,
    qrCode: { payload: qrCode.payload, image: qrCode.encodedImage, expiresAt: qrCode.expirationDate },
    amount: fees.amount,
    pixFee: fees.pixFee,
    total: fees.totalCharged,
  };
}

export async function createProPlanPayment(userId: string, cpfCnpj?: string) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, userId),
  });
  if (!creator) throw new Error('Você precisa ser um criador');
  if (creator.isPro) throw new Error('Você já é PRO');

  const fees = calculateFees(LIMITS.PRO_PLAN_PRICE, 'pro_plan');
  const customerId = await ensureAsaasCustomer(userId, cpfCnpj);

  const [payment] = await db
    .insert(payments)
    .values({
      payerId: userId,
      type: 'pro_plan',
      amount: fees.amount,
      pixFee: fees.pixFee,
      platformFee: fees.platformFee,
      creatorAmount: 0,
      description: 'Plano PRO VIPS',
      status: 'pending',
    })
    .returning();

  const { payment: asaasPayment, qrCode } = await createPixPayment({
    customerId,
    value: toReais(fees.totalCharged),
    description: 'Plano PRO VIPS',
    externalReference: payment.id,
  });

  const [updatedPayment] = await db
    .update(payments)
    .set({
      asaasPaymentId: asaasPayment.id,
      asaasPixQrCode: qrCode.payload,
      asaasPixQrCodeImage: qrCode.encodedImage,
      asaasPixExpiresAt: new Date(qrCode.expirationDate),
    })
    .where(eq(payments.id, payment.id))
    .returning();

  return {
    payment: updatedPayment,
    qrCode: { payload: qrCode.payload, image: qrCode.encodedImage, expiresAt: qrCode.expirationDate },
    amount: fees.amount,
    pixFee: fees.pixFee,
    total: fees.totalCharged,
  };
}

export async function confirmPayment(paymentId: string) {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment) throw new Error('Pagamento não encontrado');
  if (payment.status === 'confirmed') return payment;

  // Atualizar pagamento
  await db
    .update(payments)
    .set({ status: 'confirmed', paidAt: new Date(), updatedAt: new Date() })
    .where(eq(payments.id, paymentId));

  // Processar por tipo
  if (payment.type === 'subscription' && payment.creatorId) {
    // Extrair duração do metadata ou usar 1 mês como padrão
    const duration = (payment.metadata as { duration?: string })?.duration as '1' | '3' | '6' | '12' || '1';

    // Criar assinatura diretamente (PIX é instantâneo)
    await subscriptionService.createSubscription(
      payment.payerId,
      payment.creatorId,
      payment.amount,
      duration,
      payment.asaasPaymentId || undefined
    );
  }

  if (payment.type === 'ppv' && payment.contentId) {
    await db.insert(contentPurchases).values({
      userId: payment.payerId,
      contentId: payment.contentId,
      pricePaid: payment.amount,
    });
  }

  if (payment.type === 'pro_plan') {
    const creator = await db.query.creators.findFirst({
      where: eq(creators.userId, payment.payerId),
    });
    if (creator) {
      await db
        .update(creators)
        .set({
          isPro: true,
          proExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(creators.id, creator.id));
    }
  }

  // Atualizar saldo do criador (se aplicável)
  if (payment.creatorId && payment.creatorAmount > 0) {
    await db
      .update(balances)
      .set({
        available: sql`${balances.available} + ${payment.creatorAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(balances.creatorId, payment.creatorId));

    // Atualizar total de ganhos
    await db
      .update(creators)
      .set({
        totalEarnings: sql`${creators.totalEarnings} + ${payment.creatorAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, payment.creatorId));
  }

  // Enviar email de confirmação
  const payer = await db.query.users.findFirst({ where: eq(users.id, payment.payerId) });
  if (payer) {
    await sendEmail({
      to: payer.email,
      subject: 'Pagamento Confirmado - VIPS',
      html: paymentConfirmedTemplate(
        payer.name || '',
        formatCurrency(payment.amount + payment.pixFee),
        payment.description || payment.type
      ),
    });
  }

  return payment;
}

export async function getPaymentById(paymentId: string) {
  return db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
}

export async function listUserPayments(userId: string, input: ListPaymentsInput) {
  const { page, pageSize, type, status } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(payments.payerId, userId)];
  if (type !== 'all') conditions.push(eq(payments.type, type));
  if (status !== 'all') conditions.push(eq(payments.status, status));

  const paymentsList = await db
    .select()
    .from(payments)
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(...conditions));

  return {
    data: paymentsList,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function listCreatorEarnings(creatorId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const paymentsList = await db
    .select()
    .from(payments)
    .where(and(eq(payments.creatorId, creatorId), eq(payments.status, 'confirmed')))
    .orderBy(desc(payments.paidAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(eq(payments.creatorId, creatorId), eq(payments.status, 'confirmed')));

  return {
    data: paymentsList,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function markPaymentExpired(paymentId: string) {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment) return null;
  if (payment.status !== 'pending') return payment;

  const [updated] = await db
    .update(payments)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(eq(payments.id, paymentId))
    .returning();

  return updated;
}

export async function markPaymentFailed(paymentId: string) {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment) return null;
  if (payment.status !== 'pending') return payment;

  const [updated] = await db
    .update(payments)
    .set({ status: 'failed', updatedAt: new Date() })
    .where(eq(payments.id, paymentId))
    .returning();

  return updated;
}

export async function refundPayment(paymentId: string) {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment) throw new Error('Pagamento não encontrado');
  if (payment.status !== 'confirmed') throw new Error('Apenas pagamentos confirmados podem ser reembolsados');

  // Reverter saldo do criador
  if (payment.creatorId && payment.creatorAmount > 0) {
    await db
      .update(balances)
      .set({
        available: sql`GREATEST(${balances.available} - ${payment.creatorAmount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(balances.creatorId, payment.creatorId));

    await db
      .update(creators)
      .set({
        totalEarnings: sql`GREATEST(${creators.totalEarnings} - ${payment.creatorAmount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, payment.creatorId));
  }

  // Marcar como reembolsado
  const [updated] = await db
    .update(payments)
    .set({ status: 'refunded', updatedAt: new Date() })
    .where(eq(payments.id, paymentId))
    .returning();

  return updated;
}
