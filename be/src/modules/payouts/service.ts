import { db } from '@/db';
import { payouts, balances, creators } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { transferToPix, detectPixKeyType } from '@/lib/asaas';
import { toReais } from '@/lib/utils';
import { LIMITS } from '@/config/constants';
import type { ListPayoutsInput } from './schemas';

export async function requestPayout(creatorId: string, amount?: number) {
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });
  if (!creator) throw new Error('Criador não encontrado');

  if (!creator.asaasPixKey) {
    throw new Error('Configure sua chave PIX antes de solicitar saque');
  }

  const balance = await db.query.balances.findFirst({ where: eq(balances.creatorId, creatorId) });
  if (!balance || balance.available < LIMITS.MIN_PAYOUT_AMOUNT) {
    throw new Error(`Saldo mínimo para saque é ${(LIMITS.MIN_PAYOUT_AMOUNT / 100).toFixed(2)}`);
  }

  const payoutAmount = amount || balance.available;

  if (payoutAmount > balance.available) {
    throw new Error('Saldo insuficiente');
  }

  if (payoutAmount < LIMITS.MIN_PAYOUT_AMOUNT) {
    throw new Error(`Valor mínimo para saque é R$ ${(LIMITS.MIN_PAYOUT_AMOUNT / 100).toFixed(2)}`);
  }

  // Criar registro de payout
  const [payout] = await db
    .insert(payouts)
    .values({
      creatorId,
      amount: payoutAmount,
      status: 'processing',
    })
    .returning();

  // Deduzir do saldo
  await db
    .update(balances)
    .set({
      available: sql`${balances.available} - ${payoutAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(balances.creatorId, creatorId));

  try {
    // Transferir via Asaas
    const transfer = await transferToPix({
      value: toReais(payoutAmount),
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

    return { ...payout, asaasTransferId: transfer.id };
  } catch (error) {
    // Reverter saldo em caso de erro
    await db
      .update(balances)
      .set({
        available: sql`${balances.available} + ${payoutAmount}`,
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
