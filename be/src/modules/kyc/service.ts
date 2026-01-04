import { db } from '@/db';
import { kycVerifications, creators, auditLogs, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { uploadToS3, getSignedFileUrl } from '@/lib/s3';
import { sendEmail } from '@/lib/email';
import type { SubmitKycInput, ReviewKycInput, ListKycInput } from './schemas';

const KYC_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface KycFiles {
  documentFront: File;
  documentBack?: File;
  selfie: File;
}

interface KycMetadata {
  ipAddress?: string;
  userAgent?: string;
}

function generateKycKey(creatorId: string, type: 'front' | 'back' | 'selfie', extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `kyc/${creatorId}/${timestamp}-${type}-${random}.${extension}`;
}

async function uploadKycDocument(file: File, creatorId: string, type: 'front' | 'back' | 'selfie'): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.');
  }

  if (file.size > KYC_DOCUMENT_MAX_SIZE) {
    throw new Error('Arquivo muito grande. Máximo 10MB.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const key = generateKycKey(creatorId, type, ext);

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToS3(key, buffer, file.type);

  return key;
}

export async function submitKyc(
  creatorId: string,
  input: SubmitKycInput,
  files: KycFiles,
  metadata: KycMetadata
) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
  });

  if (!creator) {
    throw new Error('Criador não encontrado');
  }

  // Check if already has pending or approved KYC
  const existingKyc = await db.query.kycVerifications.findFirst({
    where: and(
      eq(kycVerifications.creatorId, creatorId),
      sql`${kycVerifications.status} IN ('pending', 'under_review', 'approved')`
    ),
  });

  if (existingKyc) {
    if (existingKyc.status === 'approved') {
      throw new Error('Verificação KYC já aprovada');
    }
    throw new Error('Você já possui uma verificação KYC pendente');
  }

  // Upload documents
  const documentFrontUrl = await uploadKycDocument(files.documentFront, creatorId, 'front');
  let documentBackUrl: string | undefined;

  if (input.documentType === 'rg' && files.documentBack) {
    documentBackUrl = await uploadKycDocument(files.documentBack, creatorId, 'back');
  }

  const selfieUrl = await uploadKycDocument(files.selfie, creatorId, 'selfie');

  // Create KYC record
  const [kyc] = await db
    .insert(kycVerifications)
    .values({
      creatorId,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      documentFrontUrl,
      documentBackUrl,
      selfieUrl,
      fullName: input.fullName,
      birthDate: input.birthDate,
      status: 'pending',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    })
    .returning();

  // Update creator KYC status
  await db
    .update(creators)
    .set({
      kycStatus: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId));

  return kyc;
}

export async function getKycStatus(creatorId: string) {
  const kyc = await db.query.kycVerifications.findFirst({
    where: eq(kycVerifications.creatorId, creatorId),
    orderBy: [desc(kycVerifications.createdAt)],
  });

  if (!kyc) {
    return { status: 'none' as const, kyc: null };
  }

  return {
    status: kyc.status,
    kyc: {
      id: kyc.id,
      status: kyc.status,
      documentType: kyc.documentType,
      fullName: kyc.fullName,
      rejectionReason: kyc.rejectionReason,
      createdAt: kyc.createdAt,
      reviewedAt: kyc.reviewedAt,
    },
  };
}

export async function getPendingKycVerifications(input: ListKycInput) {
  const { page, pageSize, status } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status !== 'all') {
    conditions.push(eq(kycVerifications.status, status));
  }

  const kycs = await db
    .select({
      id: kycVerifications.id,
      creatorId: kycVerifications.creatorId,
      documentType: kycVerifications.documentType,
      fullName: kycVerifications.fullName,
      status: kycVerifications.status,
      createdAt: kycVerifications.createdAt,
      creatorDisplayName: creators.displayName,
      creatorUsername: users.username,
    })
    .from(kycVerifications)
    .innerJoin(creators, eq(creators.id, kycVerifications.creatorId))
    .innerJoin(users, eq(users.id, creators.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(kycVerifications.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kycVerifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    data: kycs,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export async function getKycById(kycId: string) {
  const kyc = await db.query.kycVerifications.findFirst({
    where: eq(kycVerifications.id, kycId),
  });

  if (!kyc) {
    return null;
  }

  // Generate presigned URLs for documents (15 min expiry)
  const [documentFrontUrl, selfieUrl] = await Promise.all([
    getSignedFileUrl(kyc.documentFrontUrl),
    getSignedFileUrl(kyc.selfieUrl),
  ]);

  let documentBackUrl: string | undefined;
  if (kyc.documentBackUrl) {
    documentBackUrl = await getSignedFileUrl(kyc.documentBackUrl);
  }

  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, kyc.creatorId),
  });

  // Get username from users table
  let username: string | null = null;
  if (creator) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, creator.userId),
    });
    username = user?.username || null;
  }

  return {
    ...kyc,
    documentFrontUrl,
    documentBackUrl,
    selfieUrl,
    creator: creator
      ? {
          id: creator.id,
          displayName: creator.displayName,
          username,
          cpfCnpj: creator.cpfCnpj,
          subscriberCount: creator.subscriberCount,
          totalEarnings: creator.totalEarnings,
        }
      : null,
  };
}

export async function reviewKyc(
  kycId: string,
  adminId: string,
  input: ReviewKycInput,
  ipAddress?: string
) {
  const kyc = await db.query.kycVerifications.findFirst({
    where: eq(kycVerifications.id, kycId),
  });

  if (!kyc) {
    throw new Error('Verificação KYC não encontrada');
  }

  if (kyc.status === 'approved') {
    throw new Error('Esta verificação já foi aprovada');
  }

  if (input.status === 'rejected' && !input.rejectionReason) {
    throw new Error('Motivo da rejeição é obrigatório');
  }

  // Update KYC
  await db
    .update(kycVerifications)
    .set({
      status: input.status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: input.rejectionReason,
      updatedAt: new Date(),
    })
    .where(eq(kycVerifications.id, kycId));

  // Update creator
  await db
    .update(creators)
    .set({
      kycStatus: input.status,
      kycVerifiedAt: input.status === 'approved' ? new Date() : null,
      verified: input.status === 'approved',
      updatedAt: new Date(),
    })
    .where(eq(creators.id, kyc.creatorId));

  // Create audit log
  await db.insert(auditLogs).values({
    adminId,
    action: input.status === 'approved' ? 'kyc_approved' : 'kyc_rejected',
    targetType: 'kyc',
    targetId: kycId,
    details: {
      creatorId: kyc.creatorId,
      rejectionReason: input.rejectionReason,
    },
    ipAddress,
  });

  // Get creator for email
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, kyc.creatorId),
  });

  // Send email notification
  if (creator) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, creator.userId),
    });

    if (user?.email) {
      if (input.status === 'approved') {
        await sendEmail({
          to: user.email,
          subject: 'Verificação KYC Aprovada - VIPS',
          html: `
            <h1>Parabéns, ${creator.displayName}!</h1>
            <p>Sua verificação de identidade foi aprovada.</p>
            <p>Agora você pode solicitar saques normalmente.</p>
          `,
        });
      } else {
        await sendEmail({
          to: user.email,
          subject: 'Verificação KYC Rejeitada - VIPS',
          html: `
            <h1>Olá, ${creator.displayName}</h1>
            <p>Infelizmente sua verificação de identidade foi rejeitada.</p>
            <p><strong>Motivo:</strong> ${input.rejectionReason}</p>
            <p>Por favor, envie novos documentos corrigindo o problema indicado.</p>
          `,
        });
      }
    }
  }

  return { success: true };
}
