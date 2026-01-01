import { join, extname } from 'node:path';
import { mkdir, unlink, readdir, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { env } from '@/config/env';
import { redis } from '@/lib/redis';
import { uploadLargeToS3, generateS3Key } from '@/lib/s3';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB - must match frontend
const UPLOAD_EXPIRY = 60 * 60; // 1 hour for upload sessions
const TEMP_DIR = join(env.UPLOAD_DIR, 'temp');

interface UploadSession {
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: number;
}

interface UploadedFile {
  path: string;
  url: string;
  size: number;
  mimeType: string;
  type: 'image' | 'video';
}

function generateUploadId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function getMediaType(mimeType: string): 'image' | 'video' {
  if (mimeType.startsWith('video/')) return 'video';
  return 'image';
}

function getExtension(fileName: string, mimeType: string): string {
  const ext = extname(fileName).slice(1).toLowerCase();
  if (ext) return ext;

  // Fallback based on mime type
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };

  return mimeToExt[mimeType] || 'bin';
}

export async function initUpload(
  userId: string,
  fileName: string,
  fileSize: number,
  mimeType: string
): Promise<{ uploadId: string; totalChunks: number }> {
  // Ensure temp directory exists
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true });
  }

  const uploadId = generateUploadId();
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  const session: UploadSession = {
    userId,
    fileName,
    fileSize,
    mimeType,
    totalChunks,
    uploadedChunks: [],
    createdAt: Date.now(),
  };

  // Store session in Redis
  await redis.setex(`upload:${uploadId}`, UPLOAD_EXPIRY, JSON.stringify(session));

  // Create temp directory for chunks
  const chunkDir = join(TEMP_DIR, uploadId);
  await mkdir(chunkDir, { recursive: true });

  return { uploadId, totalChunks };
}

export async function uploadChunk(
  uploadId: string,
  userId: string,
  chunkIndex: number,
  chunk: Blob
): Promise<{ complete: boolean; uploadedChunks: number }> {
  // Get session
  const sessionData = await redis.get(`upload:${uploadId}`);
  if (!sessionData) {
    throw new Error('Upload session expired or not found');
  }

  const session: UploadSession = JSON.parse(sessionData);

  // Verify user
  if (session.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Validate chunk index
  if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    throw new Error('Invalid chunk index');
  }

  // Save chunk to disk (temp)
  const chunkDir = join(TEMP_DIR, uploadId);
  const chunkPath = join(chunkDir, `chunk-${chunkIndex}`);

  const arrayBuffer = await chunk.arrayBuffer();
  await Bun.write(chunkPath, arrayBuffer);

  // Track chunk completion using Redis SET (atomic, no race condition)
  // Each chunk gets its own key
  const chunkKey = `upload:${uploadId}:chunk:${chunkIndex}`;
  await redis.setex(chunkKey, UPLOAD_EXPIRY, '1');

  // Count completed chunks atomically
  const chunkKeys: string[] = [];
  for (let i = 0; i < session.totalChunks; i++) {
    chunkKeys.push(`upload:${uploadId}:chunk:${i}`);
  }

  // Use MGET to get all chunk statuses atomically
  const chunkStatuses = await redis.mget(...chunkKeys);
  const completedCount = chunkStatuses.filter(s => s === '1').length;
  const isComplete = completedCount === session.totalChunks;

  return {
    complete: isComplete,
    uploadedChunks: completedCount,
  };
}

export async function completeUpload(
  uploadId: string,
  userId: string
): Promise<UploadedFile> {
  // Get session
  const sessionData = await redis.get(`upload:${uploadId}`);
  if (!sessionData) {
    throw new Error('Upload session expired or not found');
  }

  const session: UploadSession = JSON.parse(sessionData);

  // Verify user
  if (session.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Verify all chunks uploaded using atomic check
  const chunkKeys: string[] = [];
  for (let i = 0; i < session.totalChunks; i++) {
    chunkKeys.push(`upload:${uploadId}:chunk:${i}`);
  }
  const chunkStatuses = await redis.mget(...chunkKeys);
  const completedCount = chunkStatuses.filter(s => s === '1').length;

  if (completedCount !== session.totalChunks) {
    throw new Error(`Missing chunks: ${completedCount}/${session.totalChunks}`);
  }

  // Merge chunks into final buffer
  const chunkDir = join(TEMP_DIR, uploadId);
  const mediaType = getMediaType(session.mimeType);
  const ext = getExtension(session.fileName, session.mimeType);

  // Read all chunks in order
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < session.totalChunks; i++) {
    const chunkPath = join(chunkDir, `chunk-${i}`);
    const chunkData = await Bun.file(chunkPath).arrayBuffer();
    chunks.push(new Uint8Array(chunkData));
  }

  // Combine chunks
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Generate S3 key and upload to Wasabi
  const s3Key = generateS3Key(userId, mediaType, ext);
  const url = await uploadLargeToS3(s3Key, combined, session.mimeType);

  // Clean up temp files
  try {
    const chunkFiles = await readdir(chunkDir);
    for (const file of chunkFiles) {
      await unlink(join(chunkDir, file));
    }
    await rmdir(chunkDir).catch(() => {});
  } catch {
    // Ignore cleanup errors
  }

  // Delete session and chunk keys from Redis
  const keysToDelete = [`upload:${uploadId}`];
  for (let i = 0; i < session.totalChunks; i++) {
    keysToDelete.push(`upload:${uploadId}:chunk:${i}`);
  }
  await redis.del(...keysToDelete);

  return {
    path: s3Key,
    url,
    size: session.fileSize,
    mimeType: session.mimeType,
    type: mediaType,
  };
}

export async function cancelUpload(uploadId: string, userId: string): Promise<void> {
  // Get session
  const sessionData = await redis.get(`upload:${uploadId}`);
  if (!sessionData) return;

  const session: UploadSession = JSON.parse(sessionData);

  // Verify user
  if (session.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Clean up temp files
  const chunkDir = join(TEMP_DIR, uploadId);
  try {
    if (existsSync(chunkDir)) {
      const chunkFiles = await readdir(chunkDir);
      for (const file of chunkFiles) {
        await unlink(join(chunkDir, file));
      }
      await rmdir(chunkDir).catch(() => {});
    }
  } catch {
    // Ignore cleanup errors
  }

  // Delete session and chunk keys from Redis
  const keysToDelete = [`upload:${uploadId}`];
  for (let i = 0; i < session.totalChunks; i++) {
    keysToDelete.push(`upload:${uploadId}:chunk:${i}`);
  }
  await redis.del(...keysToDelete);
}
