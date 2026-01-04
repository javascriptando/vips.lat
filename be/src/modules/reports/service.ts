import { db } from '@/db';
import {
  reports,
  reporterCredibility,
  accountSuspensions,
  auditLogs,
  contents,
  creators,
  users,
  messages,
} from '@/db/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import type { CreateReportInput, ReviewReportInput, ListReportsInput } from './schemas';

const REPORTS_PER_HOUR_LIMIT = 5;

// Priority scores for different reasons
const REASON_PRIORITY: Record<string, number> = {
  underage: 10,
  illegal_content: 9,
  fraud: 7,
  impersonation: 6,
  harassment: 5,
  copyright: 4,
  spam: 2,
  other: 1,
};

export async function checkReportLimit(reporterId: string): Promise<boolean> {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, reporterId),
        gte(reports.createdAt, oneHourAgo)
      )
    );

  return count < REPORTS_PER_HOUR_LIMIT;
}

export async function createReport(reporterId: string, input: CreateReportInput) {
  // Check rate limit
  const canReport = await checkReportLimit(reporterId);
  if (!canReport) {
    throw new Error('Você atingiu o limite de denúncias. Tente novamente mais tarde.');
  }

  // Validate target exists
  let targetExists = false;
  let targetCreatorId: string | undefined;
  let targetUserId: string | undefined;

  switch (input.reportType) {
    case 'content': {
      const content = await db.query.contents.findFirst({
        where: eq(contents.id, input.targetId),
      });
      targetExists = !!content;
      targetCreatorId = content?.creatorId;
      break;
    }
    case 'creator': {
      const creator = await db.query.creators.findFirst({
        where: eq(creators.id, input.targetId),
      });
      targetExists = !!creator;
      targetCreatorId = creator?.id;
      targetUserId = creator?.userId;
      break;
    }
    case 'message': {
      const message = await db.query.messages.findFirst({
        where: eq(messages.id, input.targetId),
      });
      targetExists = !!message;
      targetUserId = message?.senderId;
      break;
    }
    case 'user': {
      const user = await db.query.users.findFirst({
        where: eq(users.id, input.targetId),
      });
      targetExists = !!user;
      targetUserId = user?.id;
      break;
    }
  }

  if (!targetExists) {
    throw new Error('Conteúdo não encontrado');
  }

  // Prevent self-reporting
  if (targetUserId === reporterId) {
    throw new Error('Você não pode denunciar a si mesmo');
  }

  // Check for duplicate report
  const existingReport = await db.query.reports.findFirst({
    where: and(
      eq(reports.reporterId, reporterId),
      eq(reports.reportType, input.reportType),
      input.reportType === 'content'
        ? eq(reports.targetContentId, input.targetId)
        : input.reportType === 'creator'
        ? eq(reports.targetCreatorId, input.targetId)
        : input.reportType === 'message'
        ? eq(reports.targetMessageId, input.targetId)
        : eq(reports.targetUserId, input.targetId),
      sql`${reports.status} IN ('pending', 'under_review')`
    ),
  });

  if (existingReport) {
    throw new Error('Você já denunciou este conteúdo');
  }

  // Get reporter credibility for priority
  const credibility = await db.query.reporterCredibility.findFirst({
    where: eq(reporterCredibility.userId, reporterId),
  });

  // Calculate priority
  let priority = REASON_PRIORITY[input.reason] || 1;
  if (credibility?.isTrusted) {
    priority += 5;
  }
  if (credibility?.isFlagged) {
    priority -= 3;
  }

  // Create report
  const [report] = await db
    .insert(reports)
    .values({
      reporterId,
      reportType: input.reportType,
      targetContentId: input.reportType === 'content' ? input.targetId : null,
      targetCreatorId: input.reportType === 'creator' ? input.targetId : targetCreatorId,
      targetMessageId: input.reportType === 'message' ? input.targetId : null,
      targetUserId: input.reportType === 'user' ? input.targetId : targetUserId,
      reason: input.reason,
      description: input.description,
      priority: Math.max(0, priority),
    })
    .returning();

  // Update reporter stats
  await db
    .insert(reporterCredibility)
    .values({
      userId: reporterId,
      totalReports: 1,
    })
    .onConflictDoUpdate({
      target: reporterCredibility.userId,
      set: {
        totalReports: sql`${reporterCredibility.totalReports} + 1`,
        updatedAt: new Date(),
      },
    });

  return report;
}

export async function getReports(input: ListReportsInput) {
  const { page, pageSize, status, reportType, reason } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status !== 'all') {
    conditions.push(eq(reports.status, status));
  }
  if (reportType !== 'all') {
    conditions.push(eq(reports.reportType, reportType));
  }
  if (reason !== 'all') {
    conditions.push(eq(reports.reason, reason));
  }

  const reportsList = await db
    .select({
      id: reports.id,
      reportType: reports.reportType,
      reason: reports.reason,
      description: reports.description,
      status: reports.status,
      priority: reports.priority,
      createdAt: reports.createdAt,
      targetContentId: reports.targetContentId,
      targetCreatorId: reports.targetCreatorId,
      targetUserId: reports.targetUserId,
      targetMessageId: reports.targetMessageId,
      reporter: {
        id: users.id,
        username: users.username,
        email: users.email,
      },
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reports.priority), desc(reports.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    data: reportsList,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export async function getReportById(reportId: string) {
  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  });

  if (!report) {
    return null;
  }

  // Get reporter info
  const reporter = await db.query.users.findFirst({
    where: eq(users.id, report.reporterId),
    columns: { id: true, username: true, email: true },
  });

  // Get target info based on type
  let targetInfo: Record<string, unknown> = {};

  if (report.targetContentId) {
    const content = await db.query.contents.findFirst({
      where: eq(contents.id, report.targetContentId),
    });
    if (content) {
      const creator = await db.query.creators.findFirst({
        where: eq(creators.id, content.creatorId),
      });
      targetInfo = {
        content: {
          id: content.id,
          type: content.type,
          text: content.text,
          media: content.media,
          visibility: content.visibility,
          createdAt: content.createdAt,
        },
        creator: creator ? {
          id: creator.id,
          displayName: creator.displayName,
        } : null,
      };
    }
  }

  if (report.targetCreatorId && !report.targetContentId) {
    const creator = await db.query.creators.findFirst({
      where: eq(creators.id, report.targetCreatorId),
    });
    if (creator) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, creator.userId),
      });
      targetInfo = {
        creator: {
          id: creator.id,
          displayName: creator.displayName,
          bio: creator.bio,
          subscriberCount: creator.subscriberCount,
          verified: creator.verified,
          createdAt: creator.createdAt,
        },
        user: user ? {
          id: user.id,
          email: user.email,
          username: user.username,
        } : null,
      };
    }
  }

  if (report.targetMessageId) {
    const message = await db.query.messages.findFirst({
      where: eq(messages.id, report.targetMessageId),
    });
    if (message) {
      const sender = await db.query.users.findFirst({
        where: eq(users.id, message.senderId),
      });
      targetInfo = {
        message: {
          id: message.id,
          text: message.text,
          createdAt: message.createdAt,
        },
        sender: sender ? {
          id: sender.id,
          username: sender.username,
        } : null,
      };
    }
  }

  if (report.targetUserId && !report.targetCreatorId && !report.targetMessageId) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, report.targetUserId),
    });
    if (user) {
      targetInfo = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
        },
      };
    }
  }

  return {
    ...report,
    reporter,
    target: targetInfo,
  };
}

export async function reviewReport(
  reportId: string,
  adminId: string,
  input: ReviewReportInput,
  ipAddress?: string
) {
  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  });

  if (!report) {
    throw new Error('Denúncia não encontrada');
  }

  if (report.status === 'resolved' || report.status === 'dismissed') {
    throw new Error('Esta denúncia já foi processada');
  }

  // Update report
  await db
    .update(reports)
    .set({
      status: input.action === 'dismissed' ? 'dismissed' : 'resolved',
      action: input.action,
      actionNote: input.actionNote,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reports.id, reportId));

  // Execute action
  switch (input.action) {
    case 'content_removed':
      if (report.targetContentId) {
        await db
          .update(contents)
          .set({
            isPublished: false,
            updatedAt: new Date(),
          })
          .where(eq(contents.id, report.targetContentId));

        await db.insert(auditLogs).values({
          adminId,
          action: 'content_removed',
          targetType: 'content',
          targetId: report.targetContentId,
          details: { reportId, reason: report.reason },
          ipAddress,
        });
      }
      break;

    case 'creator_suspended':
      if (report.targetCreatorId) {
        const creator = await db.query.creators.findFirst({
          where: eq(creators.id, report.targetCreatorId),
        });

        if (creator) {
          const endsAt = input.suspensionDays
            ? new Date(Date.now() + input.suspensionDays * 24 * 60 * 60 * 1000)
            : null;

          await db
            .update(users)
            .set({
              isSuspended: true,
              suspendedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(users.id, creator.userId));

          await db.insert(accountSuspensions).values({
            userId: creator.userId,
            type: input.suspensionDays ? 'temporary' : 'permanent',
            reason: `Denúncia: ${report.reason}${input.actionNote ? ` - ${input.actionNote}` : ''}`,
            reportId,
            endsAt,
            suspendedBy: adminId,
          });

          await db.insert(auditLogs).values({
            adminId,
            action: 'account_suspended',
            targetType: 'user',
            targetId: creator.userId,
            details: { reportId, reason: report.reason, days: input.suspensionDays },
            ipAddress,
          });
        }
      }
      break;

    case 'user_banned':
      const targetUserId = report.targetUserId || (report.targetCreatorId
        ? (await db.query.creators.findFirst({ where: eq(creators.id, report.targetCreatorId) }))?.userId
        : null);

      if (targetUserId) {
        await db
          .update(users)
          .set({
            isSuspended: true,
            suspendedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, targetUserId));

        await db.insert(accountSuspensions).values({
          userId: targetUserId,
          type: 'permanent',
          reason: `Banido: ${report.reason}${input.actionNote ? ` - ${input.actionNote}` : ''}`,
          reportId,
          suspendedBy: adminId,
        });

        await db.insert(auditLogs).values({
          adminId,
          action: 'account_banned',
          targetType: 'user',
          targetId: targetUserId,
          details: { reportId, reason: report.reason },
          ipAddress,
        });
      }
      break;
  }

  // Update reporter credibility
  const wasValid = input.action !== 'dismissed';
  await updateReporterCredibility(report.reporterId, wasValid);

  // Log the review action
  await db.insert(auditLogs).values({
    adminId,
    action: input.action === 'dismissed' ? 'report_dismissed' : 'report_reviewed',
    targetType: 'report',
    targetId: reportId,
    details: { action: input.action, actionNote: input.actionNote },
    ipAddress,
  });

  return { success: true };
}

async function updateReporterCredibility(reporterId: string, wasValid: boolean) {
  const credibility = await db.query.reporterCredibility.findFirst({
    where: eq(reporterCredibility.userId, reporterId),
  });

  if (!credibility) {
    return;
  }

  const newValidReports = credibility.validReports + (wasValid ? 1 : 0);
  const newFalseReports = credibility.falseReports + (wasValid ? 0 : 1);
  const totalResolved = newValidReports + newFalseReports;

  // Calculate new score (0-100)
  let newScore = 50;
  if (totalResolved > 0) {
    newScore = Math.round((newValidReports / totalResolved) * 100);
  }

  // Determine trust/flag status
  const isTrusted = newScore >= 80 && totalResolved >= 5;
  const isFlagged = newScore <= 20 && newFalseReports >= 3;

  await db
    .update(reporterCredibility)
    .set({
      validReports: newValidReports,
      falseReports: newFalseReports,
      score: newScore,
      isTrusted,
      isFlagged,
      updatedAt: new Date(),
    })
    .where(eq(reporterCredibility.userId, reporterId));
}
