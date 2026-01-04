import { db } from '@/db';
import { payouts, balances, creators } from '@/db/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { transferToPix, detectPixKeyType } from '@/lib/asaas';
import { toReais } from '@/lib/utils';
import { LIMITS, FEES } from '@/config/constants';
import { checkVelocity, createFraudFlag } from '@/modules/fraud/service';
import type { ListPayoutsInput } from './schemas';

// Limites de saques por mês
const PAYOUTS_PER_MONTH_REGULAR = 4; // 1 por semana
const PAYOUTS_PER_MONTH_PRO = 8;     // 2 por semana

export async function getPayoutLimitInfo(creatorId: string) {
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });
  if (!creator) return null;

  const maxPayouts = creator.isPro ? PAYOUTS_PER_MONTH_PRO : PAYOUTS_PER_MONTH_REGULAR;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payouts)
    .where(and(
      eq(payouts.creatorId, creatorId),
      gte(payouts.createdAt, thirtyDaysAgo),
      sql`${payouts.status} != 'failed'`
    ));

  return {
    used: count,
    limit: maxPayouts,
    remaining: Math.max(0, maxPayouts - count),
    isPro: creator.isPro,
  };
}

export async function requestPayout(creatorId: string, amount?: number) {
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });
  if (!creator) throw new Error('Criador não encontrado');

  // Verificar KYC aprovado
  if (creator.kycStatus !== 'approved') {
    throw new Error('Complete a verificação KYC para solicitar saques. Acesse Configurações > Verificação de Identidade.');
  }

  // Verificar se saques estão bloqueados
  if (creator.payoutsBlocked) {
    throw new Error(`Saques bloqueados: ${creator.payoutBlockReason || 'Entre em contato com o suporte.'}`);
  }

  if (!creator.asaasPixKey) {
    throw new Error('Configure sua chave PIX antes de solicitar saque');
  }

  // Verificar velocity (anti-fraude)
  const velocityCheck = await checkVelocity('payout', creator.userId, 60, 3);
  if (!velocityCheck.allowed) {
    await createFraudFlag({
      creatorId,
      type: 'velocity_payout',
      severity: 3,
      description: `${velocityCheck.count} solicitações de saque em ${velocityCheck.windowMinutes} minutos`,
    });
    throw new Error('Muitas solicitações de saque. Aguarde um momento antes de tentar novamente.');
  }

  // Verificar limite de saques no mês
  const limitInfo = await getPayoutLimitInfo(creatorId);
  if (limitInfo && limitInfo.remaining <= 0) {
    const tipoPlan = creator.isPro ? 'PRO' : 'gratuito';
    throw new Error(`Limite de ${limitInfo.limit} saques/mês atingido (plano ${tipoPlan}). Aguarde o próximo mês.`);
  }

  const balance = await db.query.balances.findFirst({ where: eq(balances.creatorId, creatorId) });
  if (!balance || balance.available < LIMITS.MIN_PAYOUT_AMOUNT) {
    throw new Error(`Saldo mínimo para saque é R$ ${(LIMITS.MIN_PAYOUT_AMOUNT / 100).toFixed(2)}`);
  }

  // Valor bruto do saque (o que será deduzido do saldo do criador)
  const grossAmount = amount || balance.available;

  if (grossAmount > balance.available) {
    throw new Error('Saldo insuficiente');
  }

  if (grossAmount < LIMITS.MIN_PAYOUT_AMOUNT) {
    throw new Error(`Valor mínimo para saque é R$ ${(LIMITS.MIN_PAYOUT_AMOUNT / 100).toFixed(2)}`);
  }

  // Taxa PIX do saque (paga pelo criador)
  const payoutFee = FEES.PAYOUT_PIX_FEE;

  // Valor líquido que o criador receberá
  const netAmount = grossAmount - payoutFee;

  if (netAmount < 100) { // Mínimo R$1,00 líquido
    throw new Error(`Valor líquido após taxa PIX (R$ ${(payoutFee / 100).toFixed(2)}) deve ser pelo menos R$ 1,00`);
  }

  // Criar registro de payout (amount = valor bruto deduzido do saldo)
  const [payout] = await db
    .insert(payouts)
    .values({
      creatorId,
      amount: grossAmount,
      status: 'processing',
    })
    .returning();

  // Deduzir valor bruto do saldo (inclui a taxa)
  await db
    .update(balances)
    .set({
      available: sql`${balances.available} - ${grossAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(balances.creatorId, creatorId));

  try {
    // Transferir valor LÍQUIDO via Asaas (criador paga a taxa)
    const transfer = await transferToPix({
      value: toReais(netAmount),
      pixKey: creator.asaasPixKey,
      pixKeyType: creator.asaasPixKeyType as 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' || detectPixKeyType(creator.asaasPixKey),
      description: `Saque VIPS`,
      externalReference: payout.id,
    });

    // Atualizar payout
    await db
      .update(payouts)
      .set({
        asaasTransferId: transfer.id,
        status: transfer.status === 'DONE' ? 'completed' : 'processing',
        processedAt: transfer.status === 'DONE' ? new Date() : null,
      })
      .where(eq(payouts.id, payout.id));

    return {
      ...payout,
      asaasTransferId: transfer.id,
      grossAmount,
      netAmount,
      fee: payoutFee,
    };
  } catch (error) {
    // Reverter saldo em caso de erro
    await db
      .update(balances)
      .set({
        available: sql`${balances.available} + ${grossAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(balances.creatorId, creatorId));

    // Marcar payout como falhou
    await db
      .update(payouts)
      .set({
        status: 'failed',
        failedReason: error instanceof Error ? error.message : 'Erro desconhecido',
      })
      .where(eq(payouts.id, payout.id));

    throw error;
  }
}

export async function listCreatorPayouts(creatorId: string, input: ListPayoutsInput) {
  const { page, pageSize, status } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(payouts.creatorId, creatorId)];
  if (status !== 'all') conditions.push(eq(payouts.status, status));

  const payoutsList = await db
    .select()
    .from(payouts)
    .where(and(...conditions))
    .orderBy(desc(payouts.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payouts)
    .where(and(...conditions));

  return {
    data: payoutsList,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function getPayoutById(payoutId: string) {
  return db.query.payouts.findFirst({ where: eq(payouts.id, payoutId) });
}

// Job para processar payouts automáticos
export async function processAutomaticPayouts() {
  const eligibleBalances = await db
    .select({
      creatorId: balances.creatorId,
      available: balances.available,
      pixKey: creators.asaasPixKey,
      pixKeyType: creators.asaasPixKeyType,
    })
    .from(balances)
    .innerJoin(creators, eq(creators.id, balances.creatorId))
    .where(sql`${balances.available} >= ${LIMITS.MIN_PAYOUT_AMOUNT}`);

  let processed = 0;

  for (const balance of eligibleBalances) {
    if (!balance.pixKey) continue;

    try {
      await requestPayout(balance.creatorId, balance.available);
      processed++;
    } catch (error) {
      console.error(`Auto payout failed for creator ${balance.creatorId}:`, error);
    }
  }

  return processed;
}
