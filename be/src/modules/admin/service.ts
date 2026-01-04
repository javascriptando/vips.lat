import { db } from '@/db';
import {
  users,
  creators,
  contents,
  payments,
  subscriptions,
  reports,
  kycVerifications,
  accountSuspensions,
  auditLogs,
  fraudFlags,
  balances,
} from '@/db/schema';
import { eq, and, desc, sql, like, or, gte, count as countFn } from 'drizzle-orm';
import type {
  SuspendUserInput,
  UnsuspendUserInput,
  BlockPayoutsInput,
  ListUsersInput,
  ListCreatorsInput,
  ListAuditLogsInput,
  ListFraudFlagsInput,
  ResolveFraudFlagInput,
} from './schemas';

// ==================== DASHBOARD ====================

export async function getDashboardStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Total counts
  const [
    [{ totalUsers }],
    [{ totalCreators }],
    [{ totalContent }],
    [{ pendingReports }],
    [{ pendingKyc }],
    [{ unresolvedFraudFlags }],
  ] = await Promise.all([
    db.select({ totalUsers: sql<number>`count(*)::int` }).from(users),
    db.select({ totalCreators: sql<number>`count(*)::int` }).from(creators),
    db.select({ totalContent: sql<number>`count(*)::int` }).from(contents),
    db
      .select({ pendingReports: sql<number>`count(*)::int` })
      .from(reports)
      .where(eq(reports.status, 'pending')),
    db
      .select({ pendingKyc: sql<number>`count(*)::int` })
      .from(kycVerifications)
      .where(eq(kycVerifications.status, 'pending')),
    db
      .select({ unresolvedFraudFlags: sql<number>`count(*)::int` })
      .from(fraudFlags)
      .where(eq(fraudFlags.isResolved, false)),
  ]);

  // Last 30 days metrics
  const [
    [{ newUsers30d }],
    [{ newCreators30d }],
    [{ revenue30d }],
    [{ suspendedUsers }],
  ] = await Promise.all([
    db
      .select({ newUsers30d: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo)),
    db
      .select({ newCreators30d: sql<number>`count(*)::int` })
      .from(creators)
      .where(gte(creators.createdAt, thirtyDaysAgo)),
    db
      .select({ revenue30d: sql<number>`coalesce(sum(${payments.platformFee}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.status, 'confirmed'), gte(payments.createdAt, thirtyDaysAgo))),
    db
      .select({ suspendedUsers: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isSuspended, true)),
  ]);

  // Recent activity (last 7 days)
  const [recentReports, recentKyc] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(gte(reports.createdAt, sevenDaysAgo)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(kycVerifications)
      .where(gte(kycVerifications.createdAt, sevenDaysAgo)),
  ]);

  return {
    overview: {
      totalUsers,
      totalCreators,
      totalContent,
      suspendedUsers,
    },
    pending: {
      reports: pendingReports,
      kyc: pendingKyc,
      fraudFlags: unresolvedFraudFlags,
    },
    last30Days: {
      newUsers: newUsers30d,
      newCreators: newCreators30d,
      platformRevenue: revenue30d,
    },
    last7Days: {
      newReports: recentReports[0]?.count || 0,
      newKycRequests: recentKyc[0]?.count || 0,
    },
  };
}

// ==================== USER MANAGEMENT ====================

export async function getUsers(input: ListUsersInput) {
  const { page, pageSize, search, role, suspended } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        like(users.email, `%${search}%`),
        like(users.username, `%${search}%`),
        like(users.name, `%${search}%`)
      )
    );
  }

  if (role !== 'all') {
    conditions.push(eq(users.role, role));
  }

  if (suspended === 'true') {
    conditions.push(eq(users.isSuspended, true));
  } else if (suspended === 'false') {
    conditions.push(eq(users.isSuspended, false));
  }

  const usersList = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      role: users.role,
      isSuspended: users.isSuspended,
      suspendedAt: users.suspendedAt,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    data: usersList,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export async function getUserById(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      passwordHash: false,
    },
  });

  if (!user) {
    return null;
  }

  // Get creator profile if exists
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, userId),
  });

  // Get active suspension
  const suspension = await db.query.accountSuspensions.findFirst({
    where: and(
      eq(accountSuspensions.userId, userId),
      eq(accountSuspensions.isActive, true)
    ),
    orderBy: [desc(accountSuspensions.createdAt)],
  });

  // Get recent activity
  const [reportsCount, paymentsCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(eq(reports.reporterId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(eq(payments.payerId, userId)),
  ]);

  return {
    user,
    creator,
    suspension,
    stats: {
      reportsSubmitted: reportsCount[0]?.count || 0,
      paymentsMade: paymentsCount[0]?.count || 0,
    },
  };
}

export async function suspendUser(
  userId: string,
  adminId: string,
  input: SuspendUserInput,
  ipAddress?: string
) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  if (user.role === 'admin') {
    throw new Error('Não é possível suspender um administrador');
  }

  if (user.isSuspended) {
    throw new Error('Usuário já está suspenso');
  }

  const endsAt = input.days
    ? new Date(Date.now() + input.days * 24 * 60 * 60 * 1000)
    : null;

  // Update user
  await db
    .update(users)
    .set({
      isSuspended: true,
      suspendedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Create suspension record
  await db.insert(accountSuspensions).values({
    userId,
    type: input.days ? 'temporary' : 'permanent',
    reason: input.reason,
    endsAt,
    suspendedBy: adminId,
  });

  // Audit log
  await db.insert(auditLogs).values({
    adminId,
    action: 'account_suspended',
    targetType: 'user',
    targetId: userId,
    details: { reason: input.reason, days: input.days },
    ipAddress,
  });

  return { success: true };
}

export async function unsuspendUser(
  userId: string,
  adminId: string,
  input: UnsuspendUserInput,
  ipAddress?: string
) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  if (!user.isSuspended) {
    throw new Error('Usuário não está suspenso');
  }

  // Update user
  await db
    .update(users)
    .set({
      isSuspended: false,
      suspendedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Revoke active suspensions
  await db
    .update(accountSuspensions)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedBy: adminId,
      revocationReason: input.reason,
    })
    .where(and(eq(accountSuspensions.userId, userId), eq(accountSuspensions.isActive, true)));

  // Audit log
  await db.insert(auditLogs).values({
    adminId,
    action: 'account_unsuspended',
    targetType: 'user',
    targetId: userId,
    details: { reason: input.reason },
    ipAddress,
  });

  return { success: true };
}

// ==================== CREATOR MANAGEMENT ====================

export async function getCreators(input: ListCreatorsInput) {
  const { page, pageSize, search, kycStatus, verified, payoutsBlocked } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        like(creators.displayName, `%${search}%`),
        like(creators.cpfCnpj, `%${search}%`)
      )
    );
  }

  if (kycStatus !== 'all') {
    conditions.push(eq(creators.kycStatus, kycStatus));
  }

  if (verified === 'true') {
    conditions.push(eq(creators.verified, true));
  } else if (verified === 'false') {
    conditions.push(eq(creators.verified, false));
  }

  if (payoutsBlocked === 'true') {
    conditions.push(eq(creators.payoutsBlocked, true));
  } else if (payoutsBlocked === 'false') {
    conditions.push(eq(creators.payoutsBlocked, false));
  }

  const creatorsList = await db
    .select({
      id: creators.id,
      userId: creators.userId,
      displayName: creators.displayName,
      cpfCnpj: creators.cpfCnpj,
      verified: creators.verified,
      kycStatus: creators.kycStatus,
      payoutsBlocked: creators.payoutsBlocked,
      subscriberCount: creators.subscriberCount,
      totalEarnings: creators.totalEarnings,
      createdAt: creators.createdAt,
      user: {
        email: users.email,
        username: users.username,
        isSuspended: users.isSuspended,
      },
    })
    .from(creators)
    .innerJoin(users, eq(users.id, creators.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(creators.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creators)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    data: creatorsList,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export async function getCreatorById(creatorId: string) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
  });

  if (!creator) {
    return null;
  }

  const [user, balance, kyc] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, creator.userId),
      columns: { passwordHash: false },
    }),
    db.query.balances.findFirst({
      where: eq(balances.creatorId, creatorId),
    }),
    db.query.kycVerifications.findFirst({
      where: eq(kycVerifications.creatorId, creatorId),
      orderBy: [desc(kycVerifications.createdAt)],
    }),
  ]);

  return {
    creator,
    user,
    balance,
    kyc: kyc
      ? {
          id: kyc.id,
          status: kyc.status,
          documentType: kyc.documentType,
          fullName: kyc.fullName,
          createdAt: kyc.createdAt,
          reviewedAt: kyc.reviewedAt,
        }
      : null,
  };
}

export async function blockCreatorPayouts(
  creatorId: string,
  adminId: string,
  input: BlockPayoutsInput,
  ipAddress?: string
) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
  });

  if (!creator) {
    throw new Error('Criador não encontrado');
  }

  if (creator.payoutsBlocked) {
    throw new Error('Saques já estão bloqueados');
  }

  await db
    .update(creators)
    .set({
      payoutsBlocked: true,
      payoutBlockReason: input.reason,
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId));

  await db.insert(auditLogs).values({
    adminId,
    action: 'payout_blocked',
    targetType: 'creator',
    targetId: creatorId,
    details: { reason: input.reason },
    ipAddress,
  });

  return { success: true };
}

export async function unblockCreatorPayouts(
  creatorId: string,
  adminId: string,
  ipAddress?: string
) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
  });

  if (!creator) {
    throw new Error('Criador não encontrado');
  }

  if (!creator.payoutsBlocked) {
    throw new Error('Saques não estão bloqueados');
  }

  await db
    .update(creators)
    .set({
      payoutsBlocked: false,
      payoutBlockReason: null,
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId));

  await db.insert(auditLogs).values({
    adminId,
    action: 'payout_unblocked',
    targetType: 'creator',
    targetId: creatorId,
    ipAddress,
  });

  return { success: true };
}

// ==================== CONTENT MANAGEMENT ====================

export async function removeContent(
  contentId: string,
  adminId: string,
  reason: string,
  ipAddress?: string
) {
  const content = await db.query.contents.findFirst({
    where: eq(contents.id, contentId),
  });

  if (!content) {
    throw new Error('Conteúdo não encontrado');
  }

  await db
    .update(contents)
    .set({
      isPublished: false,
      updatedAt: new Date(),
    })
    .where(eq(contents.id, contentId));

  await db.insert(auditLogs).values({
    adminId,
    action: 'content_removed',
    targetType: 'content',
    targetId: contentId,
    details: { reason, creatorId: content.creatorId },
    ipAddress,
  });

  return { success: true };
}

export async function restoreContent(
  contentId: string,
  adminId: string,
  ipAddress?: string
) {
  await db
    .update(contents)
    .set({
      isPublished: true,
      updatedAt: new Date(),
    })
    .where(eq(contents.id, contentId));

  await db.insert(auditLogs).values({
    adminId,
    action: 'content_restored',
    targetType: 'content',
    targetId: contentId,
    ipAddress,
  });

  return { success: true };
}

// ==================== FRAUD FLAGS ====================

export async function getFraudFlags(input: ListFraudFlagsInput) {
  const { page, pageSize, resolved, type } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (resolved === 'true') {
    conditions.push(eq(fraudFlags.isResolved, true));
  } else if (resolved === 'false') {
    conditions.push(eq(fraudFlags.isResolved, false));
  }

  if (type) {
    conditions.push(eq(fraudFlags.type, type as any));
  }

  const flags = await db
    .select()
    .from(fraudFlags)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(fraudFlags.severity), desc(fraudFlags.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fraudFlags)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    data: flags,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export async function resolveFraudFlag(
  flagId: string,
  adminId: string,
  input: ResolveFraudFlagInput,
  ipAddress?: string
) {
  const flag = await db.query.fraudFlags.findFirst({
    where: eq(fraudFlags.id, flagId),
  });

  if (!flag) {
    throw new Error('Flag não encontrada');
  }

  if (flag.isResolved) {
    throw new Error('Flag já foi resolvida');
  }

  await db
    .update(fraudFlags)
    .set({
      isResolved: true,
      resolvedBy: adminId,
      resolvedAt: new Date(),
      resolution: input.resolution,
    })
    .where(eq(fraudFlags.id, flagId));

  return { success: true };
}

// ==================== AUDIT LOGS ====================

export async function getAuditLogs(input: ListAuditLogsInput) {
  const { page, pageSize, action, adminId, targetType } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (action) {
    conditions.push(eq(auditLogs.action, action as any));
  }

  if (adminId) {
    conditions.push(eq(auditLogs.adminId, adminId));
  }

  if (targetType) {
    conditions.push(eq(auditLogs.targetType, targetType));
  }

  const logs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      admin: {
        id: users.id,
        email: users.email,
        username: users.username,
      },
    })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.adminId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    data: logs,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}
