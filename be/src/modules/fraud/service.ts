import { db } from '@/db';
import {
  fraudFlags,
  deviceFingerprints,
  chargebacks,
  users,
  creators,
  payments,
  payouts,
  balances,
} from '@/db/schema';
import { eq, and, sql, gte, or } from 'drizzle-orm';
import crypto from 'crypto';

// ==================== CPF/CNPJ VALIDATION ====================

function validateCpfChecksum(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) return false;

  // Check for known invalid CPFs
  if (/^(\d)\1+$/.test(digits)) return false;

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;

  return true;
}

function validateCnpjChecksum(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');

  if (digits.length !== 14) return false;

  // Check for known invalid CNPJs
  if (/^(\d)\1+$/.test(digits)) return false;

  // Validate first check digit
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(digits[12])) return false;

  // Validate second check digit
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(digits[13])) return false;

  return true;
}

export function validateCpfCnpj(value: string): { valid: boolean; type: 'cpf' | 'cnpj' | null } {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 11) {
    return { valid: validateCpfChecksum(digits), type: 'cpf' };
  }

  if (digits.length === 14) {
    return { valid: validateCnpjChecksum(digits), type: 'cnpj' };
  }

  return { valid: false, type: null };
}

// ==================== DUPLICATE DETECTION ====================

export async function checkDuplicateCpf(
  cpfCnpj: string,
  excludeUserId?: string
): Promise<{ userId: string; creatorId?: string } | null> {
  const normalizedCpf = cpfCnpj.replace(/\D/g, '');

  // Check in users table
  const conditions = [
    or(
      eq(users.cpfCnpj, normalizedCpf),
      eq(users.cpfCnpj, cpfCnpj) // Also check formatted version
    ),
  ];

  if (excludeUserId) {
    conditions.push(sql`${users.id} != ${excludeUserId}`);
  }

  const existingUser = await db.query.users.findFirst({
    where: and(...conditions),
  });

  if (existingUser) {
    const creator = await db.query.creators.findFirst({
      where: eq(creators.userId, existingUser.id),
    });
    return { userId: existingUser.id, creatorId: creator?.id };
  }

  // Check in creators table
  const creatorConditions = [
    or(
      eq(creators.cpfCnpj, normalizedCpf),
      eq(creators.cpfCnpj, cpfCnpj)
    ),
  ];

  if (excludeUserId) {
    creatorConditions.push(sql`${creators.userId} != ${excludeUserId}`);
  }

  const existingCreator = await db.query.creators.findFirst({
    where: and(...creatorConditions),
  });

  if (existingCreator) {
    return { userId: existingCreator.userId, creatorId: existingCreator.id };
  }

  return null;
}

// ==================== DEVICE FINGERPRINTING ====================

export function generateFingerprint(data: {
  userAgent?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  ipAddress?: string;
}): string {
  const str = JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function recordDeviceFingerprint(
  userId: string,
  fingerprint: string,
  metadata: {
    userAgent?: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    ipAddress?: string;
  }
) {
  // Check if this fingerprint exists for this user
  const existing = await db.query.deviceFingerprints.findFirst({
    where: and(
      eq(deviceFingerprints.userId, userId),
      eq(deviceFingerprints.fingerprint, fingerprint)
    ),
  });

  if (existing) {
    // Update last seen
    await db
      .update(deviceFingerprints)
      .set({ lastSeenAt: new Date() })
      .where(eq(deviceFingerprints.id, existing.id));
    return existing;
  }

  // Check if this fingerprint is associated with another user
  const otherUser = await db.query.deviceFingerprints.findFirst({
    where: and(
      eq(deviceFingerprints.fingerprint, fingerprint),
      sql`${deviceFingerprints.userId} != ${userId}`
    ),
  });

  if (otherUser) {
    // Create fraud flag for shared device
    await createFraudFlag({
      userId,
      type: 'device_fingerprint',
      severity: 3,
      description: `Dispositivo compartilhado com outro usuário: ${otherUser.userId}`,
      metadata: { sharedWithUserId: otherUser.userId, fingerprint },
    });
  }

  // Insert new fingerprint
  const [record] = await db
    .insert(deviceFingerprints)
    .values({
      userId,
      fingerprint,
      userAgent: metadata.userAgent,
      screenResolution: metadata.screenResolution,
      timezone: metadata.timezone,
      language: metadata.language,
      ipAddress: metadata.ipAddress,
    })
    .returning();

  return record;
}

// ==================== VELOCITY CHECKS ====================

interface VelocityCheckResult {
  allowed: boolean;
  count: number;
  windowMinutes: number;
  limit: number;
}

export async function checkVelocity(
  type: 'payment' | 'payout',
  userId: string,
  windowMinutes: number = 60,
  limit: number = 5
): Promise<VelocityCheckResult> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  let count = 0;

  if (type === 'payment') {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(
        and(
          eq(payments.payerId, userId),
          gte(payments.createdAt, windowStart)
        )
      );
    count = result.count;
  } else {
    // For payouts, check by creator
    const creator = await db.query.creators.findFirst({
      where: eq(creators.userId, userId),
    });

    if (creator) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(payouts)
        .where(
          and(
            eq(payouts.creatorId, creator.id),
            gte(payouts.createdAt, windowStart)
          )
        );
      count = result.count;
    }
  }

  return {
    allowed: count < limit,
    count,
    windowMinutes,
    limit,
  };
}

// ==================== FRAUD FLAGS ====================

export async function createFraudFlag(data: {
  userId?: string;
  creatorId?: string;
  type: 'duplicate_cpf' | 'velocity_payment' | 'velocity_payout' | 'suspicious_pattern' | 'chargeback' | 'device_fingerprint';
  severity: number;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const [flag] = await db
    .insert(fraudFlags)
    .values({
      userId: data.userId,
      creatorId: data.creatorId,
      type: data.type,
      severity: Math.min(5, Math.max(1, data.severity)),
      description: data.description,
      metadata: data.metadata || {},
    })
    .returning();

  return flag;
}

// ==================== CHARGEBACK HANDLING ====================

export async function processChargeback(
  paymentId: string,
  data: {
    asaasChargebackId?: string;
    amount: number;
    creatorId: string;
  }
) {
  // Create chargeback record
  const [chargeback] = await db
    .insert(chargebacks)
    .values({
      paymentId,
      creatorId: data.creatorId,
      amount: data.amount,
      asaasChargebackId: data.asaasChargebackId,
      status: 'pending',
    })
    .returning();

  // Create fraud flag
  await createFraudFlag({
    creatorId: data.creatorId,
    type: 'chargeback',
    severity: 4,
    description: `Chargeback recebido no valor de R$ ${(data.amount / 100).toFixed(2)}`,
    metadata: { paymentId, chargebackId: chargeback.id },
  });

  // Increment chargeback count
  await db
    .update(creators)
    .set({
      chargebackCount: sql`${creators.chargebackCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(creators.id, data.creatorId));

  // If creator has too many chargebacks, block payouts
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, data.creatorId),
  });

  if (creator && creator.chargebackCount >= 3 && !creator.payoutsBlocked) {
    await db
      .update(creators)
      .set({
        payoutsBlocked: true,
        payoutBlockReason: 'Múltiplos chargebacks recebidos',
        updatedAt: new Date(),
      })
      .where(eq(creators.id, data.creatorId));
  }

  return chargeback;
}

export async function applyChargebackPenalty(
  creatorId: string,
  amount: number
) {
  // Add to penalty balance
  await db
    .update(creators)
    .set({
      chargebackPenaltyBalance: sql`${creators.chargebackPenaltyBalance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId));

  // Deduct from available balance if possible
  const balance = await db.query.balances.findFirst({
    where: eq(balances.creatorId, creatorId),
  });

  if (balance && balance.available >= amount) {
    await db
      .update(balances)
      .set({
        available: sql`${balances.available} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(balances.creatorId, creatorId));

    // Clear applied penalty
    await db
      .update(creators)
      .set({
        chargebackPenaltyBalance: sql`${creators.chargebackPenaltyBalance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, creatorId));
  }
}

export async function updateChargebackStatus(
  chargebackId: string,
  status: 'pending' | 'disputed' | 'won' | 'lost'
) {
  const chargeback = await db.query.chargebacks.findFirst({
    where: eq(chargebacks.id, chargebackId),
  });

  if (!chargeback) {
    throw new Error('Chargeback não encontrado');
  }

  await db
    .update(chargebacks)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(chargebacks.id, chargebackId));

  // If lost, apply penalty
  if (status === 'lost' && !chargeback.penaltyApplied) {
    await applyChargebackPenalty(chargeback.creatorId, chargeback.amount);

    await db
      .update(chargebacks)
      .set({
        penaltyAmount: chargeback.amount,
        penaltyApplied: true,
        updatedAt: new Date(),
      })
      .where(eq(chargebacks.id, chargebackId));
  }

  // If won, decrement chargeback count
  if (status === 'won') {
    await db
      .update(creators)
      .set({
        chargebackCount: sql`GREATEST(0, ${creators.chargebackCount} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, chargeback.creatorId));
  }

  return { success: true };
}
