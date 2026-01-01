import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/config/env';
import { db } from '@/db';
import { messages, conversations } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getSignedFileUrl } from './s3';

// Use session secret as key for signing media tokens
const SECRET = new TextEncoder().encode(env.SESSION_SECRET);

// Token expiry: 1 hour for security but long enough for good UX
const TOKEN_EXPIRY = '1h';

// S3 signed URL expiry when redirecting: 15 minutes
const S3_URL_EXPIRY_SECONDS = 15 * 60;

export type SecureMediaType = 'message-ppv' | 'exclusive';

interface SecureMediaPayload {
  userId: string;
  type: SecureMediaType;
  resourceId: string; // messageId for message-ppv/exclusive
  s3Key: string;
}

/**
 * Generate a secure media access token
 * This token can be used to access protected media through the secure-media endpoint
 */
export async function generateSecureMediaToken(
  userId: string,
  type: SecureMediaType,
  resourceId: string,
  s3Key: string
): Promise<string> {
  const token = await new SignJWT({
    userId,
    type,
    resourceId,
    s3Key,
  } satisfies SecureMediaPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(SECRET);

  return token;
}

/**
 * Verify and decode a secure media token
 */
export async function verifySecureMediaToken(
  token: string
): Promise<SecureMediaPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SecureMediaPayload;
  } catch {
    return null;
  }
}

/**
 * Verify user has access to the protected media and return a fresh S3 signed URL
 * This version requires the requesting user to be provided (for session-based auth)
 */
export async function getSecureMediaUrl(
  token: string,
  requestingUserId: string
): Promise<{ url: string } | { error: string; status: number }> {
  // Verify token
  const payload = await verifySecureMediaToken(token);
  if (!payload) {
    return { error: 'Token inválido ou expirado', status: 401 };
  }

  // Verify the requesting user matches the token
  if (payload.userId !== requestingUserId) {
    return { error: 'Acesso não autorizado', status: 403 };
  }

  // Verify access based on resource type
  const hasAccess = await verifyResourceAccess(
    payload.userId,
    payload.type,
    payload.resourceId
  );

  if (!hasAccess) {
    return { error: 'Você não tem acesso a este conteúdo', status: 403 };
  }

  // Generate fresh S3 signed URL
  const url = await getSignedFileUrl(payload.s3Key);
  return { url };
}

/**
 * Verify access and return a fresh S3 signed URL using only the token
 * The token itself serves as authentication (contains userId)
 * This allows <img> and <video> tags to work without session cookies
 */
export async function getSecureMediaUrlFromToken(
  token: string
): Promise<{ url: string } | { error: string; status: number }> {
  // Verify token
  const payload = await verifySecureMediaToken(token);
  if (!payload) {
    return { error: 'Token inválido ou expirado', status: 401 };
  }

  // Verify access based on resource type using the userId from the token
  const hasAccess = await verifyResourceAccess(
    payload.userId,
    payload.type,
    payload.resourceId
  );

  if (!hasAccess) {
    return { error: 'Você não tem acesso a este conteúdo', status: 403 };
  }

  // Generate fresh S3 signed URL
  const url = await getSignedFileUrl(payload.s3Key);
  return { url };
}

/**
 * Verify user has access to a specific resource
 */
async function verifyResourceAccess(
  userId: string,
  type: SecureMediaType,
  resourceId: string
): Promise<boolean> {
  switch (type) {
    case 'message-ppv':
    case 'exclusive':
      return verifyMessagePPVAccess(userId, resourceId);
    default:
      return false;
  }
}

/**
 * Verify user has purchased/owns a PPV message media
 */
async function verifyMessagePPVAccess(
  userId: string,
  messageId: string
): Promise<boolean> {
  // Find the message and its conversation
  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  });

  if (!message) return false;

  // Get the conversation
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, message.conversationId),
  });

  if (!conversation) return false;

  // User is the recipient of the conversation and message is purchased
  if (conversation.userId === userId && message.isPurchased) {
    return true;
  }

  // User is the sender (creator) - they always have access to their own content
  if (message.senderId === userId) {
    return true;
  }

  return false;
}

/**
 * Extract S3 key from a full S3/Wasabi URL
 * URLs look like: https://bucket.s3.region.wasabisys.com/path/to/file.jpg?signature...
 * or: https://s3.region.wasabisys.com/bucket/path/to/file.jpg?signature...
 */
export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Remove query params (signature)
    let path = urlObj.pathname;

    // Remove leading slash
    if (path.startsWith('/')) {
      path = path.slice(1);
    }

    // If path style URL, remove bucket name from path
    if (path.startsWith(env.S3_BUCKET + '/')) {
      path = path.slice(env.S3_BUCKET.length + 1);
    }

    return path || null;
  } catch {
    return null;
  }
}

/**
 * Generate secure URL for a media item (to be used in API responses)
 * Returns a URL to the secure-media endpoint with the access token
 */
export async function generateSecureMediaUrl(
  userId: string,
  type: SecureMediaType,
  resourceId: string,
  originalUrl: string
): Promise<string> {
  const s3Key = extractS3KeyFromUrl(originalUrl);
  if (!s3Key) {
    // If we can't extract the key, return original URL (fallback)
    console.warn('Could not extract S3 key from URL:', originalUrl);
    return originalUrl;
  }

  const token = await generateSecureMediaToken(userId, type, resourceId, s3Key);
  return `${env.PUBLIC_URL}/api/secure-media/${token}`;
}
